/* eslint-disable no-console */
// Seeds the knowledge base + SYNTHETIC DEMO DATA. Safe to re-run (wipes and reloads).
import { PrismaClient } from "@prisma/client";
import { PRICE_BOOK, PRICE_BOOK_AS_OF } from "../src/data/priceBook";
import { CATEGORIES, SERVICE_LINES, TEMPLATES, toTemplateRecord as toRecord } from "../src/data/templates";
import { DEFAULT_ENGINE_SETTINGS, DEFAULT_LABOR_PROFILES, DEFAULT_OVERHEAD_ITEMS } from "../src/lib/defaults";
import { RISK_FACTORS } from "../src/lib/engine/riskCatalog";
import type { EstimateInput, Role } from "../src/lib/engine/types";
import { createVersion, recordActuals } from "../src/lib/estimates";
import { inputFromTemplates, type PriceEntry } from "../src/lib/scope";

const db = new PrismaClient();

async function wipe() {
  // Order matters for FK constraints.
  await db.actualLabor.deleteMany();
  await db.actualMaterial.deleteMany();
  await db.completedJob.deleteMany();
  await db.pricingRecommendation.deleteMany();
  await db.estimateRiskFactor.deleteMany();
  await db.otherCost.deleteMany();
  await db.estimateSubcontractor.deleteMany();
  await db.estimateMaterial.deleteMany();
  await db.estimateTask.deleteMany();
  await db.estimateVersion.deleteMany();
  await db.changeOrder.deleteMany();
  await db.estimateAcceptance.deleteMany();
  await db.aiRun.deleteMany();
  await db.photo.deleteMany();
  await db.estimate.deleteMany();
  await db.property.deleteMany();
  await db.customer.deleteMany();
  await db.recurringPlan.deleteMany();
  await db.jobTemplate.deleteMany();
  await db.jobCategory.deleteMany();
  await db.serviceLine.deleteMany();
  await db.materialPrice.deleteMany();
  await db.material.deleteMany();
  await db.laborProfile.deleteMany();
  await db.employee.deleteMany();
  await db.subcontractor.deleteMany();
  await db.riskFactor.deleteMany();
  await db.businessSettings.deleteMany();
  await db.user.deleteMany();
}

async function main() {
  await wipe();

  await db.user.createMany({
    data: [
      { name: "Demo Owner", email: "owner@demo.local", role: "OWNER" },
      { name: "Demo Estimator", email: "estimator@demo.local", role: "ESTIMATOR" },
      { name: "Demo Technician", email: "tech@demo.local", role: "TECHNICIAN" },
    ],
  });

  const s = DEFAULT_ENGINE_SETTINGS;
  await db.businessSettings.create({
    data: {
      id: "default",
      companyName: "TruBlue Home Service Ally — Demo Territory",
      companyPhone: "(555) 010-0100",
      companyEmail: "office@trublue-demo.local",
      companyAddress: "100 Demo Way, Springfield",
      state: "",
      territoryZips: "62701,62702,62703,62704",
      licensesHeld: "[]",
      overheadItems: JSON.stringify(DEFAULT_OVERHEAD_ITEMS),
      minMarginPct: s.minMarginPct,
      targetMarginPct: s.targetMarginPct,
      premiumMarginPct: s.premiumMarginPct,
      recurringAssumptions: JSON.stringify({ visitsPerYear: 4, hoursPerVisit: 2, priorityAllowanceHours: 2, addOnDiscountPct: 0.1, note: "Phase 2 — not used in V1" }),
    },
  });

  await db.laborProfile.createMany({ data: DEFAULT_LABOR_PROFILES.map((p, i) => ({ ...p, sortOrder: i })) });
  await db.employee.createMany({
    data: [
      { name: "Alex Rivera (DEMO)", laborProfileId: "LEAD" },
      { name: "Jordan Lee (DEMO)", laborProfileId: "TECH" },
      { name: "Sam Brooks (DEMO)", laborProfileId: "HELPER" },
    ],
  });
  await db.subcontractor.createMany({
    data: [
      { name: "Demo Plumbing Co. (SYNTHETIC)", trade: "Plumbing" },
      { name: "Demo Electric LLC (SYNTHETIC)", trade: "Electrical" },
    ],
  });
  await db.riskFactor.createMany({ data: RISK_FACTORS });

  for (const sl of SERVICE_LINES) await db.serviceLine.create({ data: { ...sl } });
  for (const c of CATEGORIES) await db.jobCategory.create({ data: c });

  for (const t of TEMPLATES) {
    const r = toRecord(t);
    await db.jobTemplate.create({
      data: {
        key: r.key,
        name: r.name,
        categoryId: r.categoryId,
        description: r.description,
        unit: r.unit,
        lowHoursPerUnit: r.lowHoursPerUnit,
        typicalHoursPerUnit: r.typicalHoursPerUnit,
        highHoursPerUnit: r.highHoursPerUnit,
        setupHours: r.setupHours,
        cleanupHours: r.cleanupHours,
        crew: JSON.stringify(r.crew),
        skillLevel: r.skillLevel,
        tradeFlags: JSON.stringify(r.tradeFlags),
        keywords: JSON.stringify(r.keywords),
        complications: JSON.stringify(r.complications),
        riskKeys: JSON.stringify(r.riskKeys),
        materials: JSON.stringify(r.materials),
        otherCosts: JSON.stringify(r.otherCosts),
        questions: JSON.stringify(r.questions),
      },
    });
  }

  const asOf = new Date(PRICE_BOOK_AS_OF);
  for (const m of PRICE_BOOK) {
    await db.material.create({
      data: {
        key: m.key,
        name: m.name,
        unit: m.unit,
        category: m.category,
        wastePct: m.wastePct ?? 0,
        prices: { create: { unitCost: m.unitCost, source: "DEMO_PRICE_BOOK", sourceNote: "Synthetic demo price — replace with your supplier pricing", asOf } },
      },
    });
  }

  // ------------------------------------------------------------------ demo estimates
  const templates = new Map(TEMPLATES.map((t) => [t.key, toRecord(t)]));
  const priceBook = new Map<string, PriceEntry>(
    PRICE_BOOK.map((p) => [
      p.key,
      { key: p.key, name: p.name, unit: p.unit, category: p.category, wastePct: p.wastePct ?? 0, unitCost: p.unitCost, source: "DEMO_PRICE_BOOK", sourceNote: "", asOf: PRICE_BOOK_AS_OF },
    ]),
  );

  let n = 0;
  const year = new Date().getFullYear();
  async function demo(args: {
    customer: { name: string; customerType: string; phone?: string; email?: string; existing?: boolean };
    property: { address: string; zip: string; propertyType: string; ageBand: string; occupied: boolean };
    title: string;
    serviceLine?: EstimateInput["serviceLine"];
    picks: [string, number][];
    status: string;
    daysAgo: number;
    tweak?: (i: EstimateInput) => void;
    actuals?: { hours: [Role, number][]; materialCost: number; otherCost: number; reason: string; revenueDelta?: number };
  }) {
    n += 1;
    const createdAt = new Date(Date.now() - args.daysAgo * 86400000);
    const customer = await db.customer.create({ data: { id: `demo-cust-${n}`, ...args.customer, email: args.customer.email ?? "", phone: args.customer.phone ?? "", isDemo: true, createdAt } });
    const property = await db.property.create({ data: { id: `demo-prop-${n}`, ...args.property, customerId: customer.id } });
    const input = inputFromTemplates({
      picks: args.picks.map(([k, q]) => ({ template: templates.get(k)!, quantity: q })),
      priceBook,
      settings: DEFAULT_ENGINE_SETTINGS,
      property: args.property,
      title: args.title,
    });
    input.serviceLine = args.serviceLine ?? "ON_DEMAND";
    input.confidence = { ...input.confidence, photosCount: 2, dimensionsKnown: true, scopeClarity: "CLEAR", propertyAgeBand: args.property.ageBand };
    args.tweak?.(input);
    const est = await db.estimate.create({
      data: {
        id: `demo-est-${n}`,
        number: `TB-${year}-${String(n).padStart(4, "0")}`,
        title: args.title,
        serviceLineId: input.serviceLine,
        status: args.status,
        customerId: customer.id,
        propertyId: property.id,
        isDemo: true,
        createdAt,
      },
    });
    const { result } = await createVersion(db, {
      estimateId: est.id,
      input,
      settings: DEFAULT_ENGINE_SETTINGS,
      aiReasoning: { engine: "seed", summary: "SYNTHETIC DEMO DATA — built from job templates by the seed script." },
      note: "Demo estimate",
    });
    if (args.actuals) {
      const a = args.actuals;
      await recordActuals(db, {
        estimateId: est.id,
        actuals: {
          laborHours: a.hours.map(([role, hours]) => ({ role, hours })),
          materialCost: a.materialCost,
          subCost: 0,
          otherCost: a.otherCost,
          finalRevenue: result.quoted.price + (a.revenueDelta ?? 0),
          changeOrderRevenue: a.revenueDelta ?? 0,
          varianceReason: a.reason,
          notes: "SYNTHETIC DEMO DATA",
          completedAt: new Date(createdAt.getTime() + 5 * 86400000),
        },
      });
    }
    console.log(`  ${est.number}  ${args.status.padEnd(9)} ${args.title} → $${result.quoted.price}`);
  }

  console.log("Seeding SYNTHETIC demo estimates:");
  await demo({
    customer: { name: "Maria Gonzalez (DEMO)", customerType: "HOMEOWNER", phone: "(555) 010-1001" },
    property: { address: "214 Maple St", zip: "62704", propertyType: "SINGLE_FAMILY", ageBand: "10_25", occupied: true },
    title: "Mount 65\" TV in living room",
    picks: [["tv_mount", 1]],
    status: "COMPLETED",
    daysAgo: 40,
    actuals: { hours: [["LEAD", 2.6]], materialCost: 66, otherCost: 14, reason: "Went smoothly; studs exactly where expected." },
  });
  await demo({
    customer: { name: "David Chen (DEMO)", customerType: "HOMEOWNER", phone: "(555) 010-1002" },
    property: { address: "88 Birch Ct", zip: "62702", propertyType: "TOWNHOUSE", ageBand: "25_50", occupied: true },
    title: "Multi-task handyman visit",
    picks: [["picture_mirror_hang", 1], ["faucet_bath_replace", 1], ["door_adjust", 1], ["shelf_install", 1]],
    status: "SENT",
    daysAgo: 6,
  });
  await demo({
    customer: { name: "Eleanor Whitfield (DEMO)", customerType: "SENIOR", phone: "(555) 010-1003" },
    property: { address: "17 Willow Ln", zip: "62701", propertyType: "SINGLE_FAMILY", ageBand: "50_PLUS", occupied: true },
    title: "Install 2 shower grab bars + exterior step handrail",
    serviceLine: "SENIOR",
    picks: [["grab_bar_install", 2], ["handrail_exterior_steps", 1]],
    status: "COMPLETED",
    daysAgo: 30,
    actuals: { hours: [["LEAD", 4.4]], materialCost: 175, otherCost: 14, reason: "Grab bars faster than template; handrail concrete was sound." },
  });
  await demo({
    customer: { name: "Robert & Linda Hayes (DEMO)", customerType: "CAREGIVER", phone: "(555) 010-1004" },
    property: { address: "402 Cedar Ave", zip: "62703", propertyType: "SINGLE_FAMILY", ageBand: "25_50", occupied: true },
    title: "Bathroom safety modification",
    serviceLine: "SENIOR",
    picks: [["grab_bar_install", 2], ["toilet_replace", 1], ["handheld_shower_install", 1]],
    status: "WON",
    daysAgo: 12,
    tweak: (i) => {
      i.tasks.forEach((t) => {
        if (t.templateKey === "toilet_replace") t.crew = ["LEAD", "HELPER"];
      });
      i.risk.factors.push({ key: "UNKNOWN_CONDITIONS", note: "Existing plumbing condition unknown (shutoff valve not inspected)." });
    },
  });
  await demo({
    customer: { name: "Oakview Property Management (DEMO)", customerType: "PROPERTY_MANAGER", phone: "(555) 010-1005" },
    property: { address: "1200 Oakview Dr, Unit B", zip: "62704", propertyType: "TOWNHOUSE", ageBand: "25_50", occupied: false },
    title: "Fence repair — replace boards and repaint section",
    picks: [["fence_board_replace", 8], ["fence_paint", 16]],
    status: "COMPLETED",
    daysAgo: 22,
    actuals: { hours: [["LEAD", 5.2]], materialCost: 92, otherCost: 39, reason: "Two rails were also soft and had to be sistered; extra trip for stain." },
  });
  await demo({
    customer: { name: "Sarah Patel — Realtor (DEMO)", customerType: "REALTOR", phone: "(555) 010-1006" },
    property: { address: "9 Harbor View Rd", zip: "62702", propertyType: "SINGLE_FAMILY", ageBand: "50_PLUS", occupied: false },
    title: "Replace two interior doors before listing",
    picks: [["interior_door_replace", 2]],
    status: "DRAFT",
    daysAgo: 2,
  });
  await demo({
    customer: { name: "James Turner (DEMO)", customerType: "HOMEOWNER", phone: "(555) 010-1007" },
    property: { address: "56 Spruce St", zip: "62701", propertyType: "SINGLE_FAMILY", ageBand: "10_25", occupied: true },
    title: "Replace 10 deck boards",
    picks: [["deck_board_replace", 10]],
    status: "LOST",
    daysAgo: 18,
    tweak: (i) => (i.pricing = { selected: "PREMIUM" }),
  });

  // Phase 2 placeholder: a recurring Home Ally plan record (no V1 workflow).
  const ha = await db.customer.create({ data: { id: "demo-cust-ha", name: "Margaret O'Neil (DEMO)", customerType: "HOME_ALLY", existing: true, isDemo: true } });
  const haProp = await db.property.create({ data: { id: "demo-prop-ha", customerId: ha.id, address: "33 Elm St", zip: "62703", propertyType: "SINGLE_FAMILY", ageBand: "50_PLUS" } });
  await db.recurringPlan.create({
    data: { customerId: ha.id, propertyId: haProp.id, name: "Quarterly Home Ally Maintenance (DEMO)", visitsPerYear: 4, hoursPerVisit: 2, materialsPerVisit: 20, travelCostPerVisit: 14, adminHoursPerYear: 2, priorityAllowanceHours: 2, addOnDiscountPct: 0.1, annualPrice: 1260, isDemo: true },
  });

  console.log(`Seeded ${TEMPLATES.length} job templates, ${PRICE_BOOK.length} price-book materials.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
