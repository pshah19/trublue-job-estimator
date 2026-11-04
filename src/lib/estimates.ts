// Estimate persistence. Numbers are ALWAYS recomputed server-side by the engine before saving —
// client-submitted totals are never trusted.
import type { PrismaClient } from "@prisma/client";
import { calculateEstimate } from "./engine/estimate";
import { computeVariance, type ActualsInput } from "./engine/variance";
import type { EngineSettings, EstimateInput, EstimateResult } from "./engine/types";

export async function createVersion(
  db: PrismaClient,
  args: { estimateId: string; input: EstimateInput; settings: EngineSettings; aiReasoning?: unknown; note?: string },
) {
  const { estimateId, input, settings } = args;
  const result = calculateEstimate(input, settings);
  const last = await db.estimateVersion.findFirst({ where: { estimateId }, orderBy: { version: "desc" } });
  const version = (last?.version ?? 0) + 1;
  const created = await db.estimateVersion.create({
    data: {
      estimateId,
      version,
      inputJson: JSON.stringify(input),
      resultJson: JSON.stringify(result),
      settingsJson: JSON.stringify(settings),
      aiReasoningJson: JSON.stringify(args.aiReasoning ?? {}),
      selectedScenario: input.pricing.selected,
      quotedPrice: result.quoted.price,
      priceOverridden: input.pricing.selected === "CUSTOM",
      note: args.note ?? "",
      ...versionChildren(input, result),
    },
  });
  await db.estimate.update({ where: { id: estimateId }, data: { currentVersionId: created.id, title: input.title || undefined, serviceLineId: input.serviceLine } });
  return { version: created, result };
}

export async function recordActuals(
  db: PrismaClient,
  args: {
    estimateId: string;
    actuals: ActualsInput & { varianceReason?: string; notes?: string; materialLines?: { name: string; cost: number }[]; completedAt?: Date };
  },
) {
  const est = await db.estimate.findUniqueOrThrow({ where: { id: args.estimateId } });
  const version = await db.estimateVersion.findUniqueOrThrow({ where: { id: est.currentVersionId! } });
  const result = JSON.parse(version.resultJson) as EstimateResult;
  const settings = JSON.parse(version.settingsJson) as EngineSettings;
  const variance = computeVariance(result, args.actuals, settings);
  const a = args.actuals;
  await db.completedJob.deleteMany({ where: { estimateId: est.id } });
  const job = await db.completedJob.create({
    data: {
      estimateId: est.id,
      versionId: version.id,
      completedAt: a.completedAt ?? new Date(),
      actualMaterialCost: a.materialCost,
      actualSubCost: a.subCost,
      actualOtherCost: a.otherCost,
      finalRevenue: a.finalRevenue,
      changeOrderRevenue: a.changeOrderRevenue,
      varianceReason: a.varianceReason ?? "",
      notes: a.notes ?? "",
      resultJson: JSON.stringify(variance),
      labor: { create: a.laborHours.filter((l) => l.hours > 0).map((l) => ({ role: l.role, hours: l.hours })) },
      materials: { create: (a.materialLines ?? []).map((m) => ({ name: m.name, cost: m.cost })) },
    },
  });
  await db.estimate.update({ where: { id: est.id }, data: { status: "COMPLETED" } });
  return { job, variance };
}

/** Normalized line-item rows for a version (rebuilt from its input + computed result). */
export function versionChildren(input: EstimateInput, result: EstimateResult) {
  return {
    tasks: {
      create: input.tasks.map((t, i) => ({
        templateKey: t.templateKey ?? null,
        name: t.name,
        quantity: t.quantity,
        unit: t.unit,
        hoursPerUnit: result.labor.tasks[i]?.hoursPerUnit ?? t.hoursTypical,
        techHours: result.labor.tasks[i]?.techHours ?? 0,
        crewHours: result.labor.tasks[i]?.crewHours ?? 0,
        crew: JSON.stringify(t.crew),
        hoursSource: t.hoursSource,
      })),
    },
    materials: {
      create: result.materials.lines.map((l, i) => ({
        materialKey: input.materials[i]?.materialKey ?? null,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        unitCost: l.unitCost,
        wastePct: l.wastePct,
        markupPct: l.markupPct,
        cost: l.cost,
        sellingPrice: l.sellingPrice,
        source: l.source,
        priceDate: l.priceDate ?? null,
      })),
    },
    subcontractors: {
      create: result.direct.subs.map((s, i) => ({
        trade: s.trade,
        description: input.subcontractors[i]?.description ?? "",
        quotedCost: s.quotedCost,
        markupPct: s.markupPct,
        customerPrice: s.customerPrice,
        licenseRequired: s.licenseRequired,
        quoteReceived: s.quoteReceived,
      })),
    },
    otherCosts: { create: input.otherCosts.map((c) => ({ type: c.type, description: c.description, amount: c.amount })) },
    riskFactors: { create: result.risk.factors.map((f) => ({ key: f.key, note: f.note ?? "" })) },
    pricing: {
      create: (["COMPETITIVE", "RECOMMENDED", "PREMIUM"] as const).map((k) => ({
        scenario: k,
        price: result.scenarios[k].price,
        grossProfit: result.scenarios[k].grossProfit,
        grossMarginPct: result.scenarios[k].grossMarginPct,
        netProfit: result.scenarios[k].netProfit,
      })),
    },
  };
}
