import type { EngineSettings, LaborProfile, OverheadItem } from "./engine/types";

// Starting values for a new franchise. ALL are editable in Business Settings and are
// placeholders — not industry benchmarks. Replace with your own payroll and P&L numbers.

export const DEFAULT_LABOR_PROFILES: LaborProfile[] = [
  { role: "LEAD", name: "Lead Technician", hourlyWage: 32, payrollTaxPct: 0.0965, workersCompPct: 0.06, benefitsPerHour: 3.5, otherBurdenPct: 0.03, billingRate: 110 },
  { role: "TECH", name: "Technician", hourlyWage: 26, payrollTaxPct: 0.0965, workersCompPct: 0.06, benefitsPerHour: 2.5, otherBurdenPct: 0.03, billingRate: 95 },
  { role: "HELPER", name: "Helper", hourlyWage: 19, payrollTaxPct: 0.0965, workersCompPct: 0.06, benefitsPerHour: 1, otherBurdenPct: 0.02, billingRate: 65 },
];

export const DEFAULT_OVERHEAD_ITEMS: OverheadItem[] = [
  { name: "Franchise royalty & brand fees (fixed portion)", monthly: 1500 },
  { name: "Insurance (GL, auto, umbrella)", monthly: 1200 },
  { name: "Software & phones", monthly: 450 },
  { name: "Office / admin payroll", monthly: 2800 },
  { name: "Vehicle payments, fuel & maintenance", monthly: 1600 },
  { name: "Marketing", monthly: 1500 },
  { name: "Accounting & professional fees", monthly: 350 },
  { name: "Management payroll (owner draw allocation)", monthly: 2500 },
  { name: "Other operating expenses", monthly: 400 },
];

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  minMarginPct: 0.35,
  targetMarginPct: 0.5,
  premiumMarginPct: 0.58,
  minNetMarginPct: 0.05,
  materialMarkupPct: 0.3,
  subMarkupPct: 0.2,
  contingencyLowPct: 0.05,
  contingencyMediumPct: 0.1,
  contingencyHighPct: 0.2,
  minServiceCharge: 195,
  minBillableHours: 2,
  tripCharge: 0,
  diagnosticFee: 95,
  mileageRate: 0.7,
  defaultRoundTripMiles: 20,
  defaultTravelHours: 0.75,
  defaultProcurementHours: 0.5,
  overheadItems: DEFAULT_OVERHEAD_ITEMS,
  overheadMethod: "PER_TECH_HOUR",
  billableTechHoursPerMonth: 320,
  jobsPerMonth: 40,
  expectedMonthlyRevenue: 45000,
  hybridPerJobShare: 0.3,
  halfDayHours: 4,
  halfDayPrice: 495,
  fullDayHours: 8,
  fullDayPrice: 895,
  taxRatePct: 0,
  taxMaterialsOnly: true,
  priceRounding: 5,
  laborProfiles: DEFAULT_LABOR_PROFILES,
};
