// Converts AI (or rule-based) scope output into editable engine inputs.
// Deterministic data wins: template/history hours and price-book costs override anything the AI suggests.
import { OTHER_COST_DEFAULTS } from "@/data/priceBook";
import { RISK_BY_KEY } from "../engine/riskCatalog";
import type { MaterialInput, OtherCostInput, Role, SubcontractorInput, TaskInput } from "../engine/types";
import {
  defaultAssumptions,
  defaultExclusions,
  materialFromPrice,
  materialsForTasks,
  riskKeysFor,
  taskFromTemplate,
  uid,
  unpricedMaterial,
  type HistoryStat,
  type PriceEntry,
  type TemplateRecord,
} from "../scope";
import type { AiScope } from "./schemas";
import type { ScopeDraft } from "./types";

export function aiScopeToDraft(args: {
  ai: AiScope;
  engine: string;
  notice: string;
  templates: TemplateRecord[];
  priceBook: PriceEntry[];
  history: HistoryStat[];
  property?: { ageBand?: string; occupied?: boolean };
  photoIds?: string[];
}): ScopeDraft {
  const { ai } = args;
  const tmap = new Map(args.templates.map((t) => [t.key, t]));
  const pmap = new Map(args.priceBook.map((p) => [p.key, p]));
  const hmap = new Map(args.history.map((h) => [h.templateKey, h]));
  const explanation: string[] = [];

  const matched: { template: TemplateRecord; task: TaskInput }[] = [];
  const tasks: TaskInput[] = ai.tasks.map((t) => {
    const tpl = t.templateKey ? tmap.get(t.templateKey) : undefined;
    const crew = (t.crew.length ? t.crew : ["LEAD"]) as Role[];
    if (tpl) {
      const hist = hmap.get(tpl.key);
      const histNote = hist
        ? ` Franchise history: on ${hist.completedJobs} completed job(s) using this template, actual labor averaged ${Math.round(hist.ratio * 100)}% of estimate (display only — not auto-applied).`
        : "";
      const task = taskFromTemplate(tpl, t.quantity > 0 ? t.quantity : 1, {
        name: t.name || tpl.name,
        description: t.description || tpl.description,
        crew,
        tradeFlags: [...new Set([...tpl.tradeFlags, ...t.tradeFlags])],
        complications: [...new Set([...t.complications, ...tpl.complications])].slice(0, 8),
        dependsOn: t.dependsOn,
      });
      task.hoursRationale = `${task.hoursRationale}${histNote} Scope note: ${t.hoursRationale}`;
      if (crew.length !== tpl.crew.length)
        explanation.push(`"${task.name}": crew set to ${crew.join(" + ")} (template default ${tpl.crew.join(" + ")}) — ${t.hoursRationale}`);
      matched.push({ template: tpl, task });
      return task;
    }
    explanation.push(`"${t.name}" has no matching template — labor hours are an AI assumption and need your review.`);
    return {
      id: uid("task"),
      name: t.name,
      description: t.description,
      templateKey: null,
      quantity: t.quantity > 0 ? t.quantity : 1,
      unit: t.unit || "each",
      hoursLow: Math.max(0, t.hoursPerUnitLow),
      hoursTypical: Math.max(0, t.hoursPerUnitTypical),
      hoursHigh: Math.max(0, t.hoursPerUnitHigh),
      hoursBasis: "TYPICAL",
      customHoursPerUnit: null,
      hoursSource: "AI_ASSUMPTION",
      hoursRationale: `AI assumption (no template match) — validate. ${t.hoursRationale}`,
      setupHours: Math.max(0, t.setupHours),
      cleanupHours: Math.max(0, t.cleanupHours),
      crew,
      skill: t.skill,
      tradeFlags: t.tradeFlags,
      complications: t.complications,
      dependsOn: t.dependsOn,
    } satisfies TaskInput;
  });

  // Materials: template defaults, then AI adjustments.
  const materials: MaterialInput[] = materialsForTasks(matched, pmap);
  const byKey = new Map(materials.filter((m) => m.materialKey).map((m) => [m.materialKey!, m]));
  for (const m of ai.materials) {
    const p = m.priceBookKey ? pmap.get(m.priceBookKey) : undefined;
    if (p) {
      const existing = byKey.get(p.key);
      if (existing) {
        if (m.quantity > 0) existing.quantity = m.quantity;
        existing.customerSupplied = m.customerSupplied;
        if (m.notes) existing.notes = m.notes;
      } else {
        const line = materialFromPrice(p, m.quantity > 0 ? m.quantity : 1);
        line.customerSupplied = m.customerSupplied;
        line.notes = m.notes;
        materials.push(line);
        byKey.set(p.key, line);
      }
    } else {
      const line = unpricedMaterial(m.name, m.quantity > 0 ? m.quantity : 1, m.unit || "each", m.notes || undefined);
      line.customerSupplied = m.customerSupplied;
      materials.push(line);
    }
  }
  const unpriced = materials.filter((m) => m.unitCost == null && !m.customerSupplied).length;
  if (unpriced) explanation.push(`${unpriced} material(s) aren't in the price book — enter a verified unit cost before sending.`);

  // Other direct costs (amounts are editable demo defaults; permits always start at $0).
  const otherCosts: OtherCostInput[] = [];
  const seen = new Set<string>();
  const addCost = (type: OtherCostInput["type"], description: string) => {
    const k = type === "DISPOSAL" ? "DISPOSAL" : `${type}:${description.toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    otherCosts.push({ id: uid("oc"), type, description: type === "DISPOSAL" ? "Dump / disposal fee" : description, amount: OTHER_COST_DEFAULTS[type] ?? 0 });
  };
  matched.forEach(({ template }) => template.otherCosts.forEach((c) => addCost(c.type, c.description)));
  ai.otherCosts.forEach((c) => addCost(c.type, c.description));
  if (otherCosts.some((c) => c.type === "PERMIT"))
    explanation.push("A permit line was added at $0 — enter the actual fee if your jurisdiction requires one.");

  const subcontractors: SubcontractorInput[] = ai.subcontractors.map((s) => ({
    id: uid("sub"),
    trade: s.trade,
    description: s.reason,
    quotedCost: 0,
    markupPct: null,
    licenseRequired: s.licenseLikely,
    quoteReceived: false,
  }));
  if (subcontractors.length) explanation.push(`${subcontractors.length} subcontractor line(s) added with $0 cost — get a quote and enter it.`);

  const riskMap = new Map<string, string | undefined>();
  riskKeysFor(matched.map((m) => m.template), args.property).forEach((k) => riskMap.set(k, undefined));
  ai.riskFactors.forEach((r) => RISK_BY_KEY[r.key] && riskMap.set(r.key, r.reason));
  const riskFactors = [...riskMap.entries()].map(([key, note]) => ({ key, note }));

  explanation.unshift(
    `${matched.length} of ${tasks.length} task(s) matched job templates; their labor hours are template assumptions marked "Needs validation".`,
  );

  return {
    engine: args.engine,
    notice: args.notice,
    jobTitle: ai.jobTitle,
    summary: ai.summary,
    scopeClarity: ai.scopeClarity,
    needsClarification: ai.needsClarification,
    tasks,
    materials,
    otherCosts,
    subcontractors,
    riskFactors,
    photoFindings: ai.photoFindings.map((f) => ({ ...f, photoId: args.photoIds?.[f.photoIndex] })),
    questions: ai.questions,
    assumptions: [...new Set([...ai.assumptions, ...defaultAssumptions()])],
    exclusions: [...new Set([...ai.exclusions, ...defaultExclusions(matched.map((m) => m.template))])],
    dimensionsKnown: !ai.needsClarification && ai.scopeClarity === "CLEAR",
    explanation,
  };
}
