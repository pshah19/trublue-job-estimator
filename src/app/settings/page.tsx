import { SettingsForm, type SettingsFormValue } from "@/components/SettingsForm";
import { loadBusinessSettings, loadLaborProfiles, loadPriceBook, parseJson } from "@/lib/data";
import type { OverheadItem } from "@/lib/engine/types";
import { can } from "@/lib/role";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [role, s, labor, priceBook] = await Promise.all([getRole(), loadBusinessSettings(), loadLaborProfiles(), loadPriceBook()]);
  const value: SettingsFormValue = {
    companyName: s.companyName, companyPhone: s.companyPhone, companyEmail: s.companyEmail, companyAddress: s.companyAddress,
    state: s.state, territoryZips: s.territoryZips, licensesHeld: s.licensesHeld,
    minMarginPct: s.minMarginPct, targetMarginPct: s.targetMarginPct, premiumMarginPct: s.premiumMarginPct, minNetMarginPct: s.minNetMarginPct,
    materialMarkupPct: s.materialMarkupPct, subMarkupPct: s.subMarkupPct,
    contingencyLowPct: s.contingencyLowPct, contingencyMediumPct: s.contingencyMediumPct, contingencyHighPct: s.contingencyHighPct,
    minServiceCharge: s.minServiceCharge, minBillableHours: s.minBillableHours, tripCharge: s.tripCharge, diagnosticFee: s.diagnosticFee,
    mileageRate: s.mileageRate, defaultRoundTripMiles: s.defaultRoundTripMiles, defaultTravelHours: s.defaultTravelHours, defaultProcurementHours: s.defaultProcurementHours,
    overheadItems: parseJson<OverheadItem[]>(s.overheadItems, []), overheadMethod: s.overheadMethod as SettingsFormValue["overheadMethod"],
    billableTechHoursPerMonth: s.billableTechHoursPerMonth, jobsPerMonth: s.jobsPerMonth, expectedMonthlyRevenue: s.expectedMonthlyRevenue, hybridPerJobShare: s.hybridPerJobShare,
    standardWorkdayHours: s.standardWorkdayHours, halfDayHours: s.halfDayHours, halfDayPrice: s.halfDayPrice, fullDayHours: s.fullDayHours, fullDayPrice: s.fullDayPrice,
    taxRatePct: s.taxRatePct, taxMaterialsOnly: s.taxMaterialsOnly, priceRounding: s.priceRounding,
    paymentTerms: s.paymentTerms, warrantyText: s.warrantyText, estimateValidDays: s.estimateValidDays,
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Business settings</h1>
        <p className="text-sm text-muted">Every pricing assumption lives here — nothing is buried in code. Values are starting placeholders; replace them with your own numbers.</p>
      </div>
      <SettingsForm initial={value} labor={labor} priceBook={priceBook} editable={can(role).editSettings} />
    </div>
  );
}
