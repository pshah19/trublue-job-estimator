import { round2, sum } from "./money";
import type {
  DirectCostResult,
  EngineSettings,
  OtherCostInput,
  SubcontractorInput,
  TravelInput,
} from "./types";

/**
 * DIRECT JOB COST = Labor + Materials at cost + Equipment + Subcontractors + Disposal
 *                 + Travel (mileage) + Permits/Fees + Other direct costs
 * Travel labor is included in `labor`; mileage is in `travel`.
 */
export function computeDirectCosts(args: {
  laborCost: number;
  materialCost: number;
  otherCosts: OtherCostInput[];
  subcontractors: SubcontractorInput[];
  travel: TravelInput;
  settings: EngineSettings;
}): DirectCostResult {
  const { laborCost, materialCost, otherCosts, subcontractors, travel, settings } = args;
  const byType = (types: string[]) =>
    sum(otherCosts.filter((c) => types.includes(c.type)).map((c) => Math.max(0, c.amount)));

  const subs = subcontractors.map((s) => {
    const markupPct = s.markupPct ?? settings.subMarkupPct;
    return {
      id: s.id,
      trade: s.trade,
      quotedCost: round2(Math.max(0, s.quotedCost)),
      markupPct,
      customerPrice: round2(Math.max(0, s.quotedCost) * (1 + markupPct)),
      licenseRequired: s.licenseRequired,
      quoteReceived: s.quoteReceived,
    };
  });

  const mileageCost = round2(Math.max(0, travel.visits) * Math.max(0, travel.roundTripMiles) * settings.mileageRate);

  const equipment = byType(["EQUIPMENT"]);
  const disposal = byType(["DISPOSAL"]);
  const permitsFees = byType(["PERMIT", "PARKING", "TOLLS"]);
  const other = byType(["DELIVERY", "SPECIAL_ORDER", "OTHER"]);
  const subTotal = sum(subs.map((s) => s.quotedCost));

  return {
    labor: round2(laborCost),
    materials: round2(materialCost),
    equipment,
    subcontractors: subTotal,
    disposal,
    travel: mileageCost,
    permitsFees,
    other,
    total: sum([laborCost, materialCost, equipment, subTotal, disposal, mileageCost, permitsFees, other]),
    subs,
    mileageCost,
  };
}
