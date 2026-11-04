import { round2, safeDiv, sum } from "./money";
import { rateTable } from "./labor";
import type { EngineSettings, EstimateResult, Role } from "./types";

export interface ActualsInput {
  laborHours: { role: Role; hours: number }[];
  materialCost: number;
  subCost: number;
  otherCost: number; // equipment, disposal, mileage, fees actually incurred
  finalRevenue: number;
  changeOrderRevenue: number;
}

export interface VarianceLine {
  label: string;
  estimated: number;
  actual: number;
  variance: number; // actual − estimated
  variancePct: number;
}

export interface VarianceResult {
  laborHours: VarianceLine;
  laborCost: VarianceLine;
  materials: VarianceLine;
  subcontractors: VarianceLine;
  other: VarianceLine;
  directCost: VarianceLine;
  revenue: VarianceLine;
  grossProfit: VarianceLine;
  grossMargin: { estimated: number; actual: number; variancePts: number };
  actualLaborCost: number;
  actualDirectCost: number;
  summary: string;
}

function line(label: string, estimated: number, actual: number): VarianceLine {
  const e = round2(estimated);
  const a = round2(actual);
  return { label, estimated: e, actual: a, variance: round2(a - e), variancePct: safeDiv(a - e, e) };
}

/** Estimate vs actual. Actual labor cost uses the loaded rates in effect for the estimate. */
export function computeVariance(est: EstimateResult, actuals: ActualsInput, settings: EngineSettings): VarianceResult {
  const rates = rateTable(settings);
  const actualHours = sum(actuals.laborHours.map((l) => l.hours));
  const actualLaborCost = sum(actuals.laborHours.map((l) => l.hours * rates[l.role].loadedCost));
  const estOther = sum([est.direct.equipment, est.direct.disposal, est.direct.travel, est.direct.permitsFees, est.direct.other]);
  const actualDirect = sum([actualLaborCost, actuals.materialCost, actuals.subCost, actuals.otherCost]);
  const revenue = round2(actuals.finalRevenue);
  const estRevenue = est.quoted.price;
  const estGP = round2(estRevenue - est.direct.total);
  const actGP = round2(revenue - actualDirect);
  const estGM = safeDiv(estGP, estRevenue);
  const actGM = safeDiv(actGP, revenue);

  const laborHours = line("Labor hours", est.labor.totalCrewHours, actualHours);
  const summaryParts = [
    `Labor ran ${laborHours.variance >= 0 ? "over" : "under"} by ${Math.abs(laborHours.variance).toFixed(1)} hrs (${(laborHours.variancePct * 100).toFixed(0)}%).`,
    `Gross margin ${(actGM * 100).toFixed(1)}% vs ${(estGM * 100).toFixed(1)}% estimated (${((actGM - estGM) * 100).toFixed(1)} pts).`,
  ];
  return {
    laborHours,
    laborCost: line("Labor cost", est.direct.labor, actualLaborCost),
    materials: line("Materials", est.direct.materials, actuals.materialCost),
    subcontractors: line("Subcontractors", est.direct.subcontractors, actuals.subCost),
    other: line("Other direct costs", estOther, actuals.otherCost),
    directCost: line("Direct job cost", est.direct.total, actualDirect),
    revenue: line("Revenue", estRevenue, revenue),
    grossProfit: line("Gross profit", estGP, actGP),
    grossMargin: { estimated: estGM, actual: actGM, variancePts: actGM - estGM },
    actualLaborCost,
    actualDirectCost: actualDirect,
    summary: summaryParts.join(" "),
  };
}
