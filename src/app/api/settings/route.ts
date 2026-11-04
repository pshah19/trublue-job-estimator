import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const n = z.coerce.number().refine(Number.isFinite);
const Body = z.object({
  settings: z.object({
    companyName: z.string(), companyPhone: z.string(), companyEmail: z.string(), companyAddress: z.string(),
    state: z.string(), territoryZips: z.string(), licensesHeld: z.string(),
    minMarginPct: n, targetMarginPct: n, premiumMarginPct: n, minNetMarginPct: n,
    materialMarkupPct: n, subMarkupPct: n,
    contingencyLowPct: n, contingencyMediumPct: n, contingencyHighPct: n,
    minServiceCharge: n, minBillableHours: n, tripCharge: n, diagnosticFee: n,
    mileageRate: n, defaultRoundTripMiles: n, defaultTravelHours: n, defaultProcurementHours: n,
    overheadItems: z.array(z.object({ name: z.string(), monthly: n })),
    overheadMethod: z.enum(["PER_TECH_HOUR", "PCT_REVENUE", "PER_JOB", "HYBRID"]),
    billableTechHoursPerMonth: n, jobsPerMonth: n, expectedMonthlyRevenue: n, hybridPerJobShare: n,
    standardWorkdayHours: n, halfDayHours: n, halfDayPrice: n, fullDayHours: n, fullDayPrice: n,
    taxRatePct: n, taxMaterialsOnly: z.boolean(), priceRounding: n,
    paymentTerms: z.string(), warrantyText: z.string(), estimateValidDays: z.coerce.number().int(),
  }),
  laborProfiles: z.array(
    z.object({ role: z.enum(["LEAD", "TECH", "HELPER"]), name: z.string(), hourlyWage: n, payrollTaxPct: n, workersCompPct: n, benefitsPerHour: n, otherBurdenPct: n, billingRate: n }),
  ),
});

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  const { settings: s, laborProfiles } = parsed.data;
  if (!(s.minMarginPct < s.targetMarginPct && s.targetMarginPct < s.premiumMarginPct && s.premiumMarginPct < 0.95))
    return NextResponse.json({ error: "Margins must satisfy minimum < target < premium < 95%." }, { status: 400 });
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...s, overheadItems: JSON.stringify(s.overheadItems) },
    update: { ...s, overheadItems: JSON.stringify(s.overheadItems) },
  });
  for (const [i, p] of laborProfiles.entries()) {
    await prisma.laborProfile.upsert({ where: { role: p.role }, create: { ...p, sortOrder: i }, update: p });
  }
  return NextResponse.json({ ok: true });
}
