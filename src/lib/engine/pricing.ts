import { fmtMoney, fmtPct, round2, roundUpTo, safeDiv } from "./money";
import { overheadAt } from "./overhead";
import type { EngineSettings, Guardrail, OverheadResult, PriceEvaluation, RiskLevel, ScenarioResult } from "./types";

/**
 * MARGIN, NOT MARKUP.
 *   Selling Price = Cost ÷ (1 − Target Margin)      e.g. $600 ÷ (1 − 0.40) = $1,000 → 40% margin
 *   (A 40% MARKUP on $600 would be $840 — only a 28.6% margin.)
 */
export function priceForMargin(cost: number, margin: number): number {
  if (margin >= 1) throw new Error("Margin must be below 100%");
  return round2(cost / (1 - margin));
}

export function markupToMargin(markup: number): number {
  return markup / (1 + markup);
}

export function marginToMarkup(margin: number): number {
  return margin / (1 - margin);
}

export interface CostBasis {
  directCost: number;
  contingency: number;
  overhead: OverheadResult;
  crewHours: number;
}

/**
 * Margin targets in Business Settings apply to RISK-ADJUSTED direct cost (direct + contingency),
 * so riskier jobs carry their contingency into the price. We still report:
 *  - Gross margin          = (Price − Direct cost) ÷ Price        (contingency unused)
 *  - Risk-adjusted margin  = (Price − Direct − Contingency) ÷ Price (contingency fully consumed) — used for guardrails
 *  - Net (fully loaded)    = Price − Direct − Contingency − Allocated overhead
 */
export function evaluatePrice(price: number, basis: CostBasis, settings: EngineSettings): PriceEvaluation {
  const p = round2(Math.max(0, price));
  const overhead = overheadAt(basis.overhead, p);
  const fullyLoadedCost = round2(basis.directCost + basis.contingency + overhead);
  const grossProfit = round2(p - basis.directCost);
  const riskAdjustedProfit = round2(p - basis.directCost - basis.contingency);
  const netProfit = round2(p - fullyLoadedCost);
  const grossMarginPct = safeDiv(grossProfit, p);
  const riskAdjustedMarginPct = safeDiv(riskAdjustedProfit, p);
  const netMarginPct = safeDiv(netProfit, p);
  const guardrail = guardrailFor(p, fullyLoadedCost, riskAdjustedMarginPct, settings);
  return {
    price: p,
    revenue: p,
    directCost: basis.directCost,
    contingency: basis.contingency,
    overhead,
    fullyLoadedCost,
    grossProfit,
    grossMarginPct,
    riskAdjustedProfit,
    riskAdjustedMarginPct,
    netProfit,
    netMarginPct,
    revenuePerCrewHour: round2(safeDiv(p, basis.crewHours)),
    guardrail,
    message: `At ${fmtMoney(p)}, estimated gross profit is ${fmtMoney(grossProfit)} and margin is ${fmtPct(grossMarginPct)} (${fmtPct(riskAdjustedMarginPct)} if the full contingency is used). Net contribution after overhead and contingency: ${fmtMoney(netProfit)}.`,
  };
}

/** Guardrail bands: LOSS (red) · MARGIN_WARNING (orange) · ACCEPTABLE (between min & target) · TARGET (green) · PREMIUM (blue). */
export function guardrailFor(
  price: number,
  fullyLoadedCost: number,
  riskAdjustedMargin: number,
  s: EngineSettings,
): Guardrail {
  const eps = 1e-6;
  if (price + eps < fullyLoadedCost) return "LOSS";
  if (riskAdjustedMargin + eps < s.minMarginPct) return "MARGIN_WARNING";
  if (riskAdjustedMargin + eps >= s.premiumMarginPct) return "PREMIUM";
  if (riskAdjustedMargin + eps >= s.targetMarginPct) return "TARGET";
  return "ACCEPTABLE";
}

export function minimumCharge(s: EngineSettings): number {
  const lead = s.laborProfiles.find((l) => l.role === "LEAD");
  const hourly = (lead?.billingRate ?? 0) * s.minBillableHours + s.tripCharge;
  return round2(Math.max(s.minServiceCharge, hourly));
}

/** Smallest price that keeps net (fully loaded) margin ≥ minNetMarginPct. */
export function netMarginFloor(basis: CostBasis, s: EngineSettings): number {
  const denom = 1 - s.minNetMarginPct - basis.overhead.pctOfRevenue;
  if (denom <= 0) return Infinity;
  return round2((basis.directCost + basis.contingency + basis.overhead.fixedPortion) / denom);
}

export function buildScenarios(args: {
  basis: CostBasis;
  settings: EngineSettings;
  riskLevel: RiskLevel;
  confidenceScore: number;
}): Record<"COMPETITIVE" | "RECOMMENDED" | "PREMIUM", ScenarioResult> {
  const { basis, settings: s, riskLevel, confidenceScore } = args;
  const minCharge = minimumCharge(s);
  const netFloor = netMarginFloor(basis, s);
  const riskAdjusted = basis.directCost + basis.contingency;

  const make = (
    scenario: "COMPETITIVE" | "RECOMMENDED" | "PREMIUM",
    label: string,
    margin: number,
    costForMargin: number,
    why: string[],
  ): ScenarioResult => {
    let raw = priceForMargin(costForMargin, margin);
    let appliedFloor: ScenarioResult["appliedFloor"] = "NONE";
    if (raw < netFloor) {
      raw = netFloor;
      appliedFloor = "NET_MARGIN";
      why.push(
        `Raised to keep at least ${fmtPct(s.minNetMarginPct)} net margin after overhead and contingency.`,
      );
    }
    if (raw < minCharge) {
      raw = minCharge;
      appliedFloor = "MIN_SERVICE";
      why.push(`Raised to the ${fmtMoney(minCharge)} minimum service charge so this small job stays profitable.`);
    }
    const price = roundUpTo(raw, s.priceRounding);
    const ev = evaluatePrice(price, basis, s);
    return {
      ...ev,
      scenario,
      label,
      targetMarginPct: margin,
      appliedFloor,
      diffFromRecommended: 0,
      explanation: why.join(" "),
    };
  };

  const competitive = make("COMPETITIVE", "Competitive", s.minMarginPct, riskAdjusted, [
    `Priced at the ${fmtPct(s.minMarginPct)} minimum acceptable margin on risk-adjusted cost (${fmtMoney(riskAdjusted)}).`,
  ]);

  let recMargin = s.targetMarginPct;
  const recWhy = [`Priced at the ${fmtPct(s.targetMarginPct)} target margin on risk-adjusted cost (${fmtMoney(riskAdjusted)}).`];
  if (confidenceScore < 55) {
    recMargin = Math.min(s.premiumMarginPct, s.targetMarginPct + 0.03);
    recWhy.push(`Confidence is low (${confidenceScore}/100), so margin is nudged +3 pts to ${fmtPct(recMargin)} to absorb estimating error.`);
  }
  const recommended = make("RECOMMENDED", "Recommended", recMargin, riskAdjusted, recWhy);

  const premiumContingency = riskLevel === "HIGH" ? round2(basis.contingency * 1.5) : basis.contingency;
  const premWhy = [`Priced at the ${fmtPct(s.premiumMarginPct)} premium margin.`];
  if (riskLevel === "HIGH") premWhy.push(`High risk: contingency increased 1.5× (${fmtMoney(premiumContingency)}) for a high-confidence price.`);
  const premium = make("PREMIUM", "Premium / High-Confidence", s.premiumMarginPct, basis.directCost + premiumContingency, premWhy);

  for (const sc of [competitive, recommended, premium]) sc.diffFromRecommended = round2(sc.price - recommended.price);
  return { COMPETITIVE: competitive, RECOMMENDED: recommended, PREMIUM: premium };
}
