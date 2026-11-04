// Deterministic estimate review checklist (always runs; the AI review adds judgment on top).
import type { EstimateInput, EstimateResult } from "./engine/types";
import type { ReviewCheck, ReviewResult } from "./ai/types";

export function ruleBasedReview(input: EstimateInput, result: EstimateResult): ReviewResult {
  const checks: ReviewCheck[] = [];
  const add = (question: string, status: ReviewCheck["status"], note: string) => checks.push({ question, status, note });
  const names = input.tasks.map((t) => `${t.name} ${t.description ?? ""}`.toLowerCase()).join(" | ");
  const hasRisk = (k: string) => result.risk.factors.some((f) => f.key === k);
  const missingCosts: string[] = [];
  const changes: ReviewResult["recommendedChanges"] = [];

  add(
    "Did we miss a task?",
    input.confidence.scopeClarity === "CLEAR" && input.confidence.openQuestions === 0 ? "OK" : "CHECK",
    input.confidence.scopeClarity === "CLEAR" ? "Scope marked clear." : "Scope not fully clear — confirm every item with the customer.",
  );

  const lowBasis = input.tasks.filter((t) => t.hoursBasis === "LOW");
  add(
    "Did we underestimate labor?",
    lowBasis.length ? "CHECK" : "OK",
    lowBasis.length ? `${lowBasis.length} task(s) use LOW-end hours: ${lowBasis.map((t) => t.name).join(", ")}.` : "Typical or higher hours used.",
  );

  const unpriced = result.materials.missingPriceCount;
  add(
    "Are materials missing?",
    unpriced ? "MISSING" : input.tasks.length && !input.materials.length ? "CHECK" : "OK",
    unpriced ? `${unpriced} material(s) have no price.` : !input.materials.length ? "No materials listed — confirm none are needed." : `${input.materials.length} material line(s).`,
  );
  if (unpriced) missingCosts.push(`${unpriced} unpriced material(s)`);

  const noCleanup = input.tasks.filter((t) => t.cleanupHours <= 0);
  add("Is cleanup included?", noCleanup.length ? "CHECK" : "OK", noCleanup.length ? `No cleanup on: ${noCleanup.map((t) => t.name).join(", ")}.` : "Cleanup time on every task.");

  const travelOk = input.travel.visits > 0 && input.travel.includeTravelLabor;
  add("Is travel included?", travelOk ? "OK" : "CHECK", travelOk ? `${input.travel.visits} visit(s), ${input.travel.roundTripMiles} mi round trip.` : "Travel labor or visits missing.");
  if (!travelOk) missingCosts.push("Travel time / mileage");

  const allSupplied = input.materials.length > 0 && input.materials.every((m) => m.customerSupplied);
  add(
    "Is procurement time included?",
    input.procurementHours > 0 || allSupplied || !input.materials.length ? "OK" : "CHECK",
    input.procurementHours > 0 ? `${input.procurementHours} hr(s) for material pickup.` : "No time to buy/pick up materials.",
  );

  const removal = /(replace|remove|tear|demo|haul)/.test(names);
  const hasDisposal = input.otherCosts.some((c) => c.type === "DISPOSAL" && c.amount > 0);
  add("Is disposal required?", removal && !hasDisposal ? "CHECK" : "OK", removal && !hasDisposal ? "Work removes existing items but no disposal fee is listed." : hasDisposal ? "Disposal fee included." : "No removal work detected.");
  if (removal && !hasDisposal) {
    missingCosts.push("Dump / disposal fee");
    changes.push({ change: "Add a disposal fee and removal time for existing items", reason: "Scope replaces/removes existing items.", suggestedHoursDelta: 0.5 });
  }

  const soloAtHeight = hasRisk("WORKING_AT_HEIGHT") && input.tasks.some((t) => t.crew.length === 1);
  const heavy = input.tasks.some((t) => t.crew.length === 1 && t.complications.some((c) => /two people|second person|heavy/i.test(c)));
  add(
    "Could another technician be required?",
    soloAtHeight || heavy ? "CHECK" : "OK",
    soloAtHeight ? "Ladder/height work with a one-person crew." : heavy ? "A complication mentions a second person or heavy item." : "Crew sizes look reasonable.",
  );

  const hidden = ["HIDDEN_BEHIND_WALLS", "WATER_DAMAGE", "UNKNOWN_CONDITIONS", "DETERIORATION"].filter(hasRisk);
  add("Is there hidden-condition risk?", hidden.length ? "CHECK" : "OK", hidden.length ? `Risk factors: ${hidden.map((k) => k.toLowerCase().replace(/_/g, " ")).join(", ")}. Exclusions should cover hidden damage.` : "None flagged.");

  const permit = result.licensingReview.trades.includes("PERMIT");
  add("Are permits potentially required?", permit ? "CHECK" : "OK", permit ? "Permit may be required — verify locally." : "No permit indicators.");

  const trades = result.licensingReview.trades.filter((t) => t !== "PERMIT");
  add("Could a licensed trade be required?", trades.length ? "CHECK" : "OK", trades.length ? `License / permit review may be required (${trades.join(", ").toLowerCase()}).` : "No regulated-trade work flagged.");

  const contingencyLow = result.risk.computedLevel === "HIGH" && result.risk.contingencyPct < 0.15;
  add("Is the contingency appropriate?", contingencyLow ? "CHECK" : "OK", `${result.risk.level} risk → ${(result.risk.contingencyPct * 100).toFixed(0)}% contingency.`);

  const g = result.quoted.guardrail;
  add(
    "Is the gross margin acceptable?",
    g === "LOSS" ? "MISSING" : g === "MARGIN_WARNING" ? "CHECK" : "OK",
    `${(result.quoted.grossMarginPct * 100).toFixed(1)}% gross / ${(result.quoted.riskAdjustedMarginPct * 100).toFixed(1)}% risk-adjusted at ${result.quoted.price.toFixed(0)}.`,
  );

  const missing = checks.filter((c) => c.status === "MISSING").length;
  const toCheck = checks.filter((c) => c.status === "CHECK").length;
  const health = missing || g === "LOSS" ? "RED" : toCheck >= 3 || g === "MARGIN_WARNING" ? "YELLOW" : "GREEN";
  return {
    engine: "rule-based",
    notice: "",
    health,
    confidence: result.confidence.label,
    confidenceScore: result.confidence.score,
    headline:
      health === "GREEN"
        ? "Estimate passes the standard checklist."
        : health === "YELLOW"
          ? `${toCheck} item(s) worth double-checking before sending.`
          : "Estimate has blocking issues — fix before sending.",
    potentialMissingCosts: missingCosts,
    mainRisks: result.risk.factors.slice(0, 4).map((f) => `${f.label}: ${f.note || f.explanation}`),
    recommendedChanges: changes,
    checklist: checks,
  };
}
