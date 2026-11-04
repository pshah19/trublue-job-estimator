import type {
  ConfidenceContext,
  ConfidenceFactor,
  ConfidenceResult,
  MaterialsResult,
  RiskResult,
  SubcontractorInput,
  TaskInput,
} from "./types";

/**
 * 0–100 confidence score. Starts at 60 and moves with the information available.
 * Deliberately capped at 95: an estimate is never certain.
 */
export function computeConfidence(args: {
  ctx: ConfidenceContext;
  tasks: TaskInput[];
  materials: MaterialsResult;
  subs: SubcontractorInput[];
  risk: RiskResult;
}): ConfidenceResult {
  const { ctx, tasks, materials, subs, risk } = args;
  const inc: ConfidenceFactor[] = [];
  const dec: ConfidenceFactor[] = [];
  const add = (cond: boolean, label: string, pts: number) => {
    if (cond) (pts >= 0 ? inc : dec).push({ label, points: pts });
  };

  add(ctx.photosCount > 0, `${ctx.photosCount} photo${ctx.photosCount === 1 ? "" : "s"} supplied`, 6);
  add(ctx.photosCount === 0, "No photos", -6);
  add(ctx.dimensionsKnown, "Dimensions/quantities known", 6);
  add(!ctx.dimensionsKnown, "Dimensions not confirmed", -8);
  add(ctx.siteVisited, "Site inspection completed", 10);

  const templated = tasks.filter((t) => t.templateKey).length;
  add(tasks.length > 0 && templated === tasks.length, "All tasks match standard job templates", 6);
  add(templated < tasks.length, `${tasks.length - templated} task(s) not based on a template`, -4);

  const histTasks = tasks.filter((t) => t.hoursSource === "HISTORY").length;
  add(ctx.similarCompletedJobs > 0, `${ctx.similarCompletedJobs} similar completed job(s) on record`, Math.min(10, 3 + ctx.similarCompletedJobs));
  add(histTasks > 0, `${histTasks} task(s) use franchise history`, 3);
  add(
    tasks.length > 0 && tasks.every((t) => t.hoursSource === "TEMPLATE_ASSUMPTION" || t.hoursSource === "AI_ASSUMPTION"),
    "Labor hours are unvalidated starting assumptions",
    -4,
  );

  const priced = materials.lines.filter((l) => !l.priceMissing && !l.customerSupplied).length;
  add(materials.lines.length > 0 && materials.missingPriceCount === 0 && priced > 0, "All material costs entered", 4);
  add(materials.missingPriceCount > 0, `${materials.missingPriceCount} material(s) unpriced`, -10);

  add(ctx.scopeClarity === "CLEAR", "Scope is clearly defined", 6);
  add(ctx.scopeClarity === "UNCLEAR", "Scope unclear", -12);
  add(ctx.openQuestions > 0, `${ctx.openQuestions} open question(s) for the customer`, -Math.min(10, ctx.openQuestions * 3));

  add(ctx.propertyAgeBand === "50_PLUS", "Property 50+ years old", -4);
  add(ctx.propertyAgeBand === "UNKNOWN", "Property age unknown", -2);

  const hidden = risk.factors.some((f) => ["HIDDEN_BEHIND_WALLS", "WATER_DAMAGE", "UNKNOWN_CONDITIONS"].includes(f.key));
  add(hidden, "Hidden-condition risk", -6);
  add(risk.factors.some((f) => f.key === "COMPLEX_DEMOLITION"), "Complex demolition", -5);
  const pending = subs.filter((s) => !s.quoteReceived).length;
  add(pending > 0, `${pending} subcontractor quote(s) pending`, -8);

  const raw = 60 + inc.reduce((a, f) => a + f.points, 0) + dec.reduce((a, f) => a + f.points, 0);
  const score = Math.max(5, Math.min(95, Math.round(raw)));
  const label = score >= 80 ? "High" : score >= 60 ? "Medium" : "Low";
  return { score, label, increasing: inc, decreasing: dec };
}
