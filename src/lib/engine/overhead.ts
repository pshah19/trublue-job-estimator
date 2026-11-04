import { round2, safeDiv, sum } from "./money";
import type { EngineSettings, OverheadResult } from "./types";

export function monthlyOverhead(settings: EngineSettings): number {
  return sum(settings.overheadItems.map((i) => Math.max(0, i.monthly)));
}

/**
 * Overhead allocation. Returns a fixed $ portion plus a % of revenue portion so
 * the pricing engine can evaluate any price exactly.
 *  - PER_TECH_HOUR: monthly overhead ÷ billable tech hours/month × job crew hours
 *  - PCT_REVENUE:   monthly overhead ÷ expected monthly revenue × price
 *  - PER_JOB:       monthly overhead ÷ jobs per month
 *  - HYBRID:        share × per-job + (1 − share) × per-tech-hour
 */
export function computeOverhead(settings: EngineSettings, crewHours: number): OverheadResult {
  const monthly = monthlyOverhead(settings);
  const perHour = safeDiv(monthly, settings.billableTechHoursPerMonth);
  const perJob = safeDiv(monthly, settings.jobsPerMonth);
  switch (settings.overheadMethod) {
    case "PCT_REVENUE": {
      const p = safeDiv(monthly, settings.expectedMonthlyRevenue);
      return {
        method: "PCT_REVENUE",
        monthlyTotal: monthly,
        fixedPortion: 0,
        pctOfRevenue: p,
        explanation: `$${monthly.toFixed(0)}/mo overhead ÷ $${settings.expectedMonthlyRevenue.toFixed(0)}/mo expected revenue = ${(p * 100).toFixed(1)}% of job revenue.`,
      };
    }
    case "PER_JOB":
      return {
        method: "PER_JOB",
        monthlyTotal: monthly,
        fixedPortion: round2(perJob),
        pctOfRevenue: 0,
        explanation: `$${monthly.toFixed(0)}/mo overhead ÷ ${settings.jobsPerMonth} jobs/mo = $${perJob.toFixed(2)} per job.`,
      };
    case "HYBRID": {
      const share = Math.min(1, Math.max(0, settings.hybridPerJobShare));
      const amount = round2(share * perJob + (1 - share) * perHour * crewHours);
      return {
        method: "HYBRID",
        monthlyTotal: monthly,
        fixedPortion: amount,
        pctOfRevenue: 0,
        explanation: `${(share * 100).toFixed(0)}% per-job ($${perJob.toFixed(2)}) + ${((1 - share) * 100).toFixed(0)}% per tech-hour ($${perHour.toFixed(2)}/hr × ${crewHours.toFixed(2)} hrs).`,
      };
    }
    default:
      return {
        method: "PER_TECH_HOUR",
        monthlyTotal: monthly,
        fixedPortion: round2(perHour * crewHours),
        pctOfRevenue: 0,
        explanation: `$${monthly.toFixed(0)}/mo overhead ÷ ${settings.billableTechHoursPerMonth} billable tech-hrs/mo = $${perHour.toFixed(2)}/hr × ${crewHours.toFixed(2)} crew hrs.`,
      };
  }
}

export function overheadAt(o: OverheadResult, price: number): number {
  return round2(o.fixedPortion + o.pctOfRevenue * price);
}
