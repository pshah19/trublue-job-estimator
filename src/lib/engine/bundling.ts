import { fmtMoney, round2 } from "./money";
import { evaluatePrice, type CostBasis } from "./pricing";
import type { BundleSuggestion, EngineSettings, LaborResult, PriceEvaluation } from "./types";

/**
 * Detects when several small tasks fit a Half-Day or Full-Day package.
 * Package price = package labor rate + pass-through costs (materials at selling, subs at customer price, other direct).
 */
export function suggestBundle(args: {
  taskCount: number;
  labor: LaborResult;
  passThrough: number;
  basis: CostBasis;
  recommended: PriceEvaluation;
  minimumCharge: number;
  settings: EngineSettings;
}): BundleSuggestion | null {
  const { taskCount, labor, passThrough, basis, recommended, minimumCharge, settings: s } = args;
  if (taskCount < 3) return null;
  const hours = labor.onSiteDurationHours;
  if (hours > s.fullDayHours) return null;
  const half = hours <= s.halfDayHours;
  const packageName = half ? "Half-Day Handyman Package" : "Full-Day Handyman Package";
  const packageHours = half ? s.halfDayHours : s.fullDayHours;
  const packagePrice = round2((half ? s.halfDayPrice : s.fullDayPrice) + passThrough);
  const separateCallsPrice = round2(taskCount * minimumCharge);
  const evaluation = evaluatePrice(packagePrice, basis, s);

  const reasons = [
    `${taskCount} tasks totaling ~${hours.toFixed(1)} on-site hours fit in one ${packageHours}-hour visit.`,
    `One trip instead of ${taskCount}: saves ${taskCount - 1} round trips of travel time and mileage.`,
    `As ${taskCount} separate service calls the customer would pay at least ${fmtMoney(separateCallsPrice)} (${taskCount} × ${fmtMoney(minimumCharge)} minimum).`,
    `Package keeps the technician fully utilized for the ${half ? "half" : "full"} day.`,
  ];
  if (evaluation.grossProfit > recommended.grossProfit) {
    reasons.push(`Package gross profit ${fmtMoney(evaluation.grossProfit)} vs ${fmtMoney(recommended.grossProfit)} at the recommended price.`);
  } else {
    reasons.push(`Package is ${fmtMoney(recommended.price - packagePrice)} below the recommended price — check margin before offering.`);
  }
  return { packageName, packageHours, packagePrice, separateCallsPrice, evaluation, reasons };
}
