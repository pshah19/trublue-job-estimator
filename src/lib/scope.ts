// Pure helpers that turn job templates + quantities into editable estimate inputs.
// Client-safe (no database access).

import { OTHER_COST_DEFAULTS } from "@/data/priceBook";
import type {
  EngineSettings,
  EstimateInput,
  MaterialInput,
  OtherCostInput,
  OtherCostType,
  Role,
  SkillLevel,
  TaskInput,
  TradeFlag,
} from "./engine/types";

export interface TemplateRecord {
  key: string;
  name: string;
  categoryId: string;
  categoryName: string;
  serviceLineId: string;
  description: string;
  unit: string;
  lowHoursPerUnit: number;
  typicalHoursPerUnit: number;
  highHoursPerUnit: number;
  setupHours: number;
  cleanupHours: number;
  crew: Role[];
  skillLevel: SkillLevel;
  tradeFlags: TradeFlag[];
  keywords: string[];
  complications: string[];
  riskKeys: string[];
  materials: { materialKey: string; qtyPerUnit?: number; perJob?: number }[];
  otherCosts: { type: OtherCostType; description: string }[];
  questions: string[];
  source: string;
  needsValidation: boolean;
  validationNote: string;
}

export interface PriceEntry {
  key: string;
  name: string;
  unit: string;
  category: string;
  wastePct: number;
  unitCost: number | null;
  source: string;
  sourceNote: string;
  asOf: string | null;
}

/** Display-only franchise history for a template (V1 never auto-applies it). */
export interface HistoryStat {
  templateKey: string;
  completedJobs: number;
  avgEstimatedCrewHours: number;
  avgActualCrewHours: number;
  ratio: number; // actual ÷ estimated
}

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter}`;
}

export function taskFromTemplate(t: TemplateRecord, quantity: number, overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    id: uid("task"),
    name: t.name,
    description: t.description,
    templateKey: t.key,
    quantity,
    unit: t.unit,
    hoursLow: t.lowHoursPerUnit,
    hoursTypical: t.typicalHoursPerUnit,
    hoursHigh: t.highHoursPerUnit,
    hoursBasis: "TYPICAL",
    customHoursPerUnit: null,
    hoursSource: t.needsValidation ? "TEMPLATE_ASSUMPTION" : "HISTORY",
    hoursRationale: t.needsValidation
      ? `Template "${t.name}": ${t.lowHoursPerUnit}–${t.highHoursPerUnit} hrs per ${t.unit} (typical ${t.typicalHoursPerUnit}). ${t.validationNote}`
      : `Template "${t.name}" (owner-validated): typical ${t.typicalHoursPerUnit} hrs per ${t.unit}.`,
    setupHours: t.setupHours,
    cleanupHours: t.cleanupHours,
    crew: [...t.crew],
    skill: t.skillLevel,
    tradeFlags: [...t.tradeFlags],
    complications: [...t.complications],
    dependsOn: [],
    ...overrides,
  };
}

export function materialFromPrice(p: PriceEntry, quantity: number, taskId?: string | null): MaterialInput {
  return {
    id: uid("mat"),
    materialKey: p.key,
    name: p.name,
    quantity: Math.round(quantity * 100) / 100,
    unit: p.unit,
    unitCost: p.unitCost,
    source: (p.unitCost == null ? "UNPRICED" : p.source) as MaterialInput["source"],
    priceDate: p.asOf,
    wastePct: p.wastePct,
    markupPct: null,
    customerSupplied: false,
    taskId: taskId ?? null,
  };
}

export function unpricedMaterial(name: string, quantity: number, unit: string, notes?: string): MaterialInput {
  return {
    id: uid("mat"),
    materialKey: null,
    name,
    quantity,
    unit,
    unitCost: null,
    source: "UNPRICED",
    priceDate: null,
    wastePct: 0,
    markupPct: null,
    customerSupplied: false,
    taskId: null,
    notes: notes ?? "Not in price book — enter a verified unit cost.",
  };
}

/** Materials for a set of template tasks; per-job items (consumables) are counted once. */
export function materialsForTasks(
  items: { template: TemplateRecord; task: TaskInput }[],
  priceBook: Map<string, PriceEntry>,
): MaterialInput[] {
  const acc = new Map<string, { qty: number; perJob: boolean; taskId: string }>();
  for (const { template, task } of items) {
    for (const m of template.materials) {
      const qty = m.perJob != null ? m.perJob : (m.qtyPerUnit ?? 0) * task.quantity;
      const perJob = m.perJob != null;
      const prev = acc.get(m.materialKey);
      if (!prev) acc.set(m.materialKey, { qty, perJob, taskId: task.id });
      else acc.set(m.materialKey, { ...prev, qty: perJob && prev.perJob ? Math.max(prev.qty, qty) : prev.qty + qty });
    }
  }
  const out: MaterialInput[] = [];
  for (const [key, v] of acc) {
    const p = priceBook.get(key);
    if (!p) continue;
    // Whole units for items sold by the piece; fractional for gallons etc.
    const fractional = ["gallon", "sq ft", "ft", "linear ft"].includes(p.unit);
    const qty = fractional ? Math.round(v.qty * 100) / 100 : Math.max(1, Math.ceil(v.qty - 1e-9));
    out.push(materialFromPrice(p, qty, v.taskId));
  }
  return out;
}

export function otherCostsForTemplates(templates: TemplateRecord[]): OtherCostInput[] {
  const seen = new Set<string>();
  const out: OtherCostInput[] = [];
  for (const t of templates) {
    for (const c of t.otherCosts) {
      const k = c.type === "DISPOSAL" ? "DISPOSAL" : `${c.type}:${c.description}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        id: uid("oc"),
        type: c.type,
        description: c.type === "DISPOSAL" ? "Dump / disposal fee" : c.description,
        amount: OTHER_COST_DEFAULTS[c.type] ?? 0,
      });
    }
  }
  return out;
}

export function riskKeysFor(templates: TemplateRecord[], property?: { ageBand?: string; occupied?: boolean }): string[] {
  const keys = new Set<string>();
  templates.forEach((t) => t.riskKeys.forEach((k) => keys.add(k)));
  if (property?.ageBand === "50_PLUS") keys.add("OLD_PROPERTY");
  if (property?.occupied) keys.add("OCCUPIED_WORKSPACE");
  return [...keys];
}

export function emptyInput(settings: EngineSettings): EstimateInput {
  return {
    title: "",
    serviceLine: "ON_DEMAND",
    tasks: [],
    procurementHours: settings.defaultProcurementHours,
    materials: [],
    otherCosts: [],
    subcontractors: [],
    travel: {
      visits: 1,
      roundTripMiles: settings.defaultRoundTripMiles,
      travelHoursPerVisit: settings.defaultTravelHours,
      includeTravelLabor: true,
    },
    risk: { factors: [], levelOverride: null, contingencyPctOverride: null },
    confidence: {
      photosCount: 0,
      dimensionsKnown: false,
      siteVisited: false,
      scopeClarity: "SOMEWHAT_CLEAR",
      propertyAgeBand: "UNKNOWN",
      similarCompletedJobs: 0,
      openQuestions: 0,
    },
    pricing: { selected: "RECOMMENDED", customPrice: null },
    assumptions: [],
    exclusions: [],
  };
}

/** Build a complete input from template picks — used by the template picker, fallback matcher and seed. */
export function inputFromTemplates(args: {
  picks: { template: TemplateRecord; quantity: number }[];
  priceBook: Map<string, PriceEntry>;
  settings: EngineSettings;
  property?: { ageBand?: string; occupied?: boolean };
  title?: string;
}): EstimateInput {
  const base = emptyInput(args.settings);
  const items = args.picks.map((p) => ({ template: p.template, task: taskFromTemplate(p.template, p.quantity) }));
  const templates = args.picks.map((p) => p.template);
  return {
    ...base,
    title: args.title ?? (templates.length === 1 ? templates[0].name : `${templates.length}-item handyman visit`),
    tasks: items.map((i) => i.task),
    materials: materialsForTasks(items, args.priceBook),
    otherCosts: otherCostsForTemplates(templates),
    risk: { factors: riskKeysFor(templates, args.property).map((key) => ({ key })), levelOverride: null, contingencyPctOverride: null },
    confidence: { ...base.confidence, propertyAgeBand: args.property?.ageBand ?? "UNKNOWN" },
    assumptions: defaultAssumptions(),
    exclusions: defaultExclusions(templates),
  };
}

export function defaultAssumptions(): string[] {
  return [
    "Work areas are accessible and clear of personal items at the scheduled time.",
    "Existing conditions behind walls, floors and fixtures are sound; hidden damage is not included.",
    "Pricing is based on the scope described; additional work requires an approved change order.",
  ];
}

export function defaultExclusions(templates: TemplateRecord[]): string[] {
  const ex = ["Repair of hidden or pre-existing damage discovered during work.", "Permit fees unless listed."];
  if (templates.some((t) => t.tradeFlags.length)) ex.push("Work requiring a licensed electrician, plumber or other licensed trade unless listed.");
  if (!templates.some((t) => t.categoryId === "painting" || t.key.includes("paint")))
    ex.push("Painting or finish work unless listed.");
  return ex;
}
