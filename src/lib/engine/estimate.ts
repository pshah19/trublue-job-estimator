import { computeConfidence } from "./confidence";
import { computeDirectCosts } from "./directCosts";
import { computeLabor } from "./labor";
import { computeMaterials } from "./materials";
import { round2, sum } from "./money";
import { computeOverhead, overheadAt } from "./overhead";
import { buildScenarios, evaluatePrice, minimumCharge, type CostBasis } from "./pricing";
import { computeRisk } from "./risk";
import { suggestBundle } from "./bundling";
import type { EngineSettings, EstimateInput, EstimateResult, EstimateWarning, TradeFlag } from "./types";

const TRADE_LABEL: Record<TradeFlag, string> = {
  ELECTRICAL: "electrical",
  PLUMBING: "plumbing",
  HVAC: "HVAC",
  STRUCTURAL: "structural",
  PERMIT: "permit-required",
  MAJOR_REMODEL: "major remodeling",
};

/**
 * The single source of truth for every number in an estimate.
 * Pure function: same input + settings → same result. AI never computes money.
 */
export function calculateEstimate(input: EstimateInput, settings: EngineSettings): EstimateResult {
  const labor = computeLabor(input.tasks, input.procurementHours, input.travel, settings);
  const materials = computeMaterials(input.materials, settings);
  const direct = computeDirectCosts({
    laborCost: labor.totalCost,
    materialCost: materials.totalCost,
    otherCosts: input.otherCosts,
    subcontractors: input.subcontractors,
    travel: input.travel,
    settings,
  });

  // Risk factors implied by the inputs are added automatically (and shown), never hidden.
  const riskFactors = [...input.risk.factors];
  const has = (k: string) => riskFactors.some((f) => f.key === k);
  if (input.materials.some((m) => m.customerSupplied) && !has("CUSTOMER_SUPPLIED"))
    riskFactors.push({ key: "CUSTOMER_SUPPLIED", note: "Auto-added: one or more materials are customer-supplied." });
  if (input.subcontractors.length > 0 && !has("SUB_DEPENDENCY"))
    riskFactors.push({ key: "SUB_DEPENDENCY", note: "Auto-added: job includes a subcontractor." });
  const risk = computeRisk({ ...input.risk, factors: riskFactors }, direct.total, settings);

  const overhead = computeOverhead(settings, labor.totalCrewHours);
  const confidence = computeConfidence({
    ctx: input.confidence,
    tasks: input.tasks,
    materials,
    subs: input.subcontractors,
    risk,
  });

  const basis: CostBasis = {
    directCost: direct.total,
    contingency: risk.contingencyAmount,
    overhead,
    crewHours: labor.totalCrewHours,
  };
  const scenarios = buildScenarios({ basis, settings, riskLevel: risk.level, confidenceScore: confidence.score });
  const minCharge = minimumCharge(settings);

  const selected = input.pricing.selected;
  const quotedPrice =
    selected === "CUSTOM" && input.pricing.customPrice != null
      ? input.pricing.customPrice
      : scenarios[selected === "CUSTOM" ? "RECOMMENDED" : selected].price;
  const quoted = { ...evaluatePrice(quotedPrice, basis, settings), scenario: selected };

  const subsCustomer = sum(direct.subs.map((s) => s.customerPrice));
  const otherPassThrough = sum([direct.equipment, direct.disposal, direct.permitsFees, direct.other, direct.travel]);
  const rateCardBuildUp = sum([labor.billableValue, materials.totalSelling, subsCustomer, otherPassThrough]);

  const bundle = suggestBundle({
    taskCount: input.tasks.length,
    labor,
    passThrough: sum([materials.totalSelling, subsCustomer, otherPassThrough]),
    basis,
    recommended: scenarios.RECOMMENDED,
    minimumCharge: minCharge,
    settings,
  });

  const taxableBase = settings.taxMaterialsOnly ? Math.min(materials.totalSelling, quoted.price) : quoted.price;
  const tax = { taxableBase: round2(taxableBase), rate: settings.taxRatePct, amount: round2(taxableBase * settings.taxRatePct) };

  const trades = new Set<TradeFlag>();
  input.tasks.forEach((t) => t.tradeFlags.forEach((f) => trades.add(f)));
  if (has("PERMIT_REQUIRED")) trades.add("PERMIT");
  const licenseSubs = input.subcontractors.some((s) => s.licenseRequired);
  const licensingRequired = trades.size > 0 || licenseSubs;

  const warnings: EstimateWarning[] = [];
  if (input.tasks.length === 0) warnings.push({ severity: "critical", code: "NO_TASKS", message: "No tasks in scope yet." });
  if (materials.missingPriceCount > 0)
    warnings.push({
      severity: "critical",
      code: "MISSING_PRICES",
      message: `${materials.missingPriceCount} material(s) have no verified price. Enter a unit cost (or mark customer-supplied) — the estimate understates cost until you do.`,
    });
  if (quoted.guardrail === "LOSS")
    warnings.push({ severity: "critical", code: "LOSS", message: "Quoted price is below the fully loaded estimated cost — this job is expected to lose money." });
  if (quoted.guardrail === "MARGIN_WARNING")
    warnings.push({ severity: "warning", code: "LOW_MARGIN", message: "Quoted price is profitable but below the minimum acceptable margin." });
  const pending = input.subcontractors.filter((s) => !s.quoteReceived);
  if (pending.length)
    warnings.push({ severity: "warning", code: "SUB_QUOTE_PENDING", message: `${pending.length} subcontractor quote(s) not yet received — cost is an assumption.` });
  if (input.tasks.some((t) => t.hoursSource === "TEMPLATE_ASSUMPTION" || t.hoursSource === "AI_ASSUMPTION"))
    warnings.push({ severity: "info", code: "UNVALIDATED_HOURS", message: "Some labor hours are starting assumptions — validate against actual TruBlue job history." });
  if (!input.tasks.some((t) => t.cleanupHours > 0))
    warnings.push({ severity: "warning", code: "NO_CLEANUP", message: "No cleanup time is included on any task." });
  if (input.travel.visits <= 0)
    warnings.push({ severity: "warning", code: "NO_TRAVEL", message: "No site visits / travel included." });
  if (scenarios.RECOMMENDED.appliedFloor === "MIN_SERVICE")
    warnings.push({ severity: "info", code: "MIN_SERVICE", message: `Calculated price is below the minimum service call — recommending the ${minCharge.toFixed(2)} minimum.` });

  return {
    labor,
    materials,
    direct,
    overhead,
    risk,
    confidence,
    costBasis: {
      directCost: direct.total,
      contingency: risk.contingencyAmount,
      riskAdjustedDirectCost: round2(direct.total + risk.contingencyAmount),
      overheadAtRecommended: overheadAt(overhead, scenarios.RECOMMENDED.price),
      fullyLoadedAtRecommended: scenarios.RECOMMENDED.fullyLoadedCost,
    },
    rateCardBuildUp,
    minimumCharge: minCharge,
    scenarios,
    quoted,
    tax,
    bundle,
    licensingReview: {
      required: licensingRequired,
      trades: [...trades],
      message: licensingRequired
        ? `License / permit review may be required${trades.size ? ` (${[...trades].map((t) => TRADE_LABEL[t]).join(", ")} work)` : ""}. Requirements vary by jurisdiction and have not been verified.`
        : "",
    },
    warnings,
    marketNote: "Local competitor pricing unavailable.",
  };
}
