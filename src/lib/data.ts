import "server-only";
import { prisma } from "./db";
import type { EngineSettings, EstimateInput, EstimateResult, LaborProfile, OverheadMethod, Role } from "./engine/types";
import type { HistoryStat, PriceEntry, TemplateRecord } from "./scope";
import { DEFAULT_ENGINE_SETTINGS } from "./defaults";

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function loadBusinessSettings() {
  const row = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  return row ?? (await prisma.businessSettings.create({ data: { id: "default" } }));
}

export async function loadLaborProfiles(): Promise<LaborProfile[]> {
  const rows = await prisma.laborProfile.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    role: r.role as Role,
    name: r.name,
    hourlyWage: r.hourlyWage,
    payrollTaxPct: r.payrollTaxPct,
    workersCompPct: r.workersCompPct,
    benefitsPerHour: r.benefitsPerHour,
    otherBurdenPct: r.otherBurdenPct,
    billingRate: r.billingRate,
  }));
}

export async function loadEngineSettings(): Promise<EngineSettings> {
  const [s, labor] = await Promise.all([loadBusinessSettings(), loadLaborProfiles()]);
  return {
    minMarginPct: s.minMarginPct,
    targetMarginPct: s.targetMarginPct,
    premiumMarginPct: s.premiumMarginPct,
    minNetMarginPct: s.minNetMarginPct,
    materialMarkupPct: s.materialMarkupPct,
    subMarkupPct: s.subMarkupPct,
    contingencyLowPct: s.contingencyLowPct,
    contingencyMediumPct: s.contingencyMediumPct,
    contingencyHighPct: s.contingencyHighPct,
    minServiceCharge: s.minServiceCharge,
    minBillableHours: s.minBillableHours,
    tripCharge: s.tripCharge,
    diagnosticFee: s.diagnosticFee,
    mileageRate: s.mileageRate,
    defaultRoundTripMiles: s.defaultRoundTripMiles,
    defaultTravelHours: s.defaultTravelHours,
    defaultProcurementHours: s.defaultProcurementHours,
    overheadItems: parseJson(s.overheadItems, DEFAULT_ENGINE_SETTINGS.overheadItems),
    overheadMethod: s.overheadMethod as OverheadMethod,
    billableTechHoursPerMonth: s.billableTechHoursPerMonth,
    jobsPerMonth: s.jobsPerMonth,
    expectedMonthlyRevenue: s.expectedMonthlyRevenue,
    hybridPerJobShare: s.hybridPerJobShare,
    halfDayHours: s.halfDayHours,
    halfDayPrice: s.halfDayPrice,
    fullDayHours: s.fullDayHours,
    fullDayPrice: s.fullDayPrice,
    taxRatePct: s.taxRatePct,
    taxMaterialsOnly: s.taxMaterialsOnly,
    priceRounding: s.priceRounding,
    laborProfiles: labor.length ? labor : DEFAULT_ENGINE_SETTINGS.laborProfiles,
  };
}

export async function loadTemplates(): Promise<TemplateRecord[]> {
  const rows = await prisma.jobTemplate.findMany({ include: { category: true }, orderBy: [{ categoryId: "asc" }, { name: "asc" }] });
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    serviceLineId: r.category.serviceLineId,
    description: r.description,
    unit: r.unit,
    lowHoursPerUnit: r.lowHoursPerUnit,
    typicalHoursPerUnit: r.typicalHoursPerUnit,
    highHoursPerUnit: r.highHoursPerUnit,
    setupHours: r.setupHours,
    cleanupHours: r.cleanupHours,
    crew: parseJson(r.crew, ["LEAD"]),
    skillLevel: r.skillLevel as TemplateRecord["skillLevel"],
    tradeFlags: parseJson(r.tradeFlags, []),
    keywords: parseJson(r.keywords, []),
    complications: parseJson(r.complications, []),
    riskKeys: parseJson(r.riskKeys, []),
    materials: parseJson(r.materials, []),
    otherCosts: parseJson(r.otherCosts, []),
    questions: parseJson(r.questions, []),
    source: r.source,
    needsValidation: r.needsValidation,
    validationNote: r.validationNote,
  }));
}

/** Latest price per material (by asOf). Each entry keeps its source + date. */
export async function loadPriceBook(): Promise<PriceEntry[]> {
  const rows = await prisma.material.findMany({
    include: { prices: { orderBy: { asOf: "desc" }, take: 1 } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map((m) => {
    const p = m.prices[0];
    return {
      key: m.key,
      name: m.name,
      unit: m.unit,
      category: m.category,
      wastePct: m.wastePct,
      unitCost: p ? p.unitCost : null,
      source: p ? p.source : "UNPRICED",
      sourceNote: p ? p.sourceNote : "",
      asOf: p ? p.asOf.toISOString().slice(0, 10) : null,
    };
  });
}

export async function loadHistoryStats(): Promise<HistoryStat[]> {
  const jobs = await prisma.completedJob.findMany({ include: { labor: true } });
  if (!jobs.length) return [];
  const versions = await prisma.estimateVersion.findMany({ where: { id: { in: jobs.map((j) => j.versionId) } } });
  const vmap = new Map(versions.map((v) => [v.id, v]));
  const agg = new Map<string, { n: number; est: number; act: number }>();
  for (const j of jobs) {
    const v = vmap.get(j.versionId);
    if (!v) continue;
    const input = parseJson<EstimateInput | null>(v.inputJson, null);
    const result = parseJson<EstimateResult | null>(v.resultJson, null);
    if (!input || !result) continue;
    const est = result.labor.totalCrewHours;
    const act = j.labor.reduce((a, l) => a + l.hours, 0);
    const keys = new Set(input.tasks.map((t) => t.templateKey).filter(Boolean) as string[]);
    for (const k of keys) {
      const a = agg.get(k) ?? { n: 0, est: 0, act: 0 };
      agg.set(k, { n: a.n + 1, est: a.est + est, act: a.act + act });
    }
  }
  return [...agg.entries()].map(([templateKey, a]) => ({
    templateKey,
    completedJobs: a.n,
    avgEstimatedCrewHours: Math.round((a.est / a.n) * 10) / 10,
    avgActualCrewHours: Math.round((a.act / a.n) * 10) / 10,
    ratio: a.est ? Math.round((a.act / a.est) * 100) / 100 : 1,
  }));
}

export async function nextEstimateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.estimate.findMany({ where: { number: { startsWith: `TB-${year}-` } }, select: { number: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.number.split("-")[2]) || 0), 0);
  return `TB-${year}-${String(max + 1).padStart(4, "0")}`;
}
