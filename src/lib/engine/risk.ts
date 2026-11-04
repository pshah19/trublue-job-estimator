import { round2 } from "./money";
import { RISK_BY_KEY, RISK_THRESHOLDS } from "./riskCatalog";
import type { EngineSettings, RiskInput, RiskLevel, RiskResult } from "./types";

export function levelFromScore(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.highAt) return "HIGH";
  if (score >= RISK_THRESHOLDS.mediumAt) return "MEDIUM";
  return "LOW";
}

export function contingencyPctFor(level: RiskLevel, s: EngineSettings): number {
  return level === "HIGH" ? s.contingencyHighPct : level === "MEDIUM" ? s.contingencyMediumPct : s.contingencyLowPct;
}

/**
 * Contingency is uncertainty, kept separate from profit. It is ALWAYS shown as its own line
 * and is calculated on direct job cost.
 */
export function computeRisk(risk: RiskInput, directCost: number, settings: EngineSettings): RiskResult {
  const seen = new Set<string>();
  const factors = risk.factors
    .filter((f) => RISK_BY_KEY[f.key] && !seen.has(f.key) && seen.add(f.key))
    .map((f) => ({ ...RISK_BY_KEY[f.key], note: f.note }));
  const score = factors.reduce((a, f) => a + f.weight, 0);
  const computedLevel = levelFromScore(score);
  const level = risk.levelOverride ?? computedLevel;
  const contingencyPct = risk.contingencyPctOverride ?? contingencyPctFor(level, settings);
  const contingencyAmount = round2(Math.max(0, directCost) * Math.max(0, contingencyPct));

  const parts = [
    `Risk score ${score} from ${factors.length} factor${factors.length === 1 ? "" : "s"} → ${computedLevel}.`,
  ];
  if (risk.levelOverride && risk.levelOverride !== computedLevel) parts.push(`Estimator set level to ${level}.`);
  parts.push(
    risk.contingencyPctOverride != null
      ? `Contingency manually set to ${(contingencyPct * 100).toFixed(1)}% of direct cost.`
      : `${level} risk uses the configured ${(contingencyPct * 100).toFixed(0)}% contingency on direct cost.`,
  );

  return { score, level, computedLevel, contingencyPct, contingencyAmount, factors, explanation: parts.join(" ") };
}
