// Shared types for the deterministic estimating engine.
// Nothing in src/lib/engine performs I/O or calls an LLM. All money is computed here.

export type Role = "LEAD" | "TECH" | "HELPER";
export const ROLES: Role[] = ["LEAD", "TECH", "HELPER"];

export type SkillLevel = "BASIC" | "SKILLED" | "ADVANCED";
export type TradeFlag = "ELECTRICAL" | "PLUMBING" | "HVAC" | "STRUCTURAL" | "PERMIT" | "MAJOR_REMODEL";
export const TRADE_FLAGS: TradeFlag[] = ["ELECTRICAL", "PLUMBING", "HVAC", "STRUCTURAL", "PERMIT", "MAJOR_REMODEL"];

export type HoursBasis = "LOW" | "TYPICAL" | "HIGH" | "CUSTOM";
/** Where the labor-hours number came from — shown to the estimator for every task. */
export type HoursSource = "TEMPLATE_ASSUMPTION" | "AI_ASSUMPTION" | "HISTORY" | "USER";

export type OverheadMethod = "PER_TECH_HOUR" | "PCT_REVENUE" | "PER_JOB" | "HYBRID";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Scenario = "COMPETITIVE" | "RECOMMENDED" | "PREMIUM" | "CUSTOM";
export type Guardrail = "LOSS" | "MARGIN_WARNING" | "ACCEPTABLE" | "TARGET" | "PREMIUM";

export type OtherCostType =
  | "EQUIPMENT"
  | "PERMIT"
  | "PARKING"
  | "TOLLS"
  | "DISPOSAL"
  | "DELIVERY"
  | "SPECIAL_ORDER"
  | "OTHER";
export const OTHER_COST_TYPES: OtherCostType[] = [
  "EQUIPMENT",
  "PERMIT",
  "PARKING",
  "TOLLS",
  "DISPOSAL",
  "DELIVERY",
  "SPECIAL_ORDER",
  "OTHER",
];

export type MaterialSource =
  | "DEMO_PRICE_BOOK"
  | "MANUAL"
  | "RECEIPT"
  | "HOME_DEPOT"
  | "LOWES"
  | "LOCAL_SUPPLIER"
  | "HISTORICAL"
  | "UNPRICED";

export interface LaborProfile {
  role: Role;
  name: string;
  hourlyWage: number;
  payrollTaxPct: number;
  workersCompPct: number;
  benefitsPerHour: number;
  otherBurdenPct: number;
  billingRate: number;
}

export interface OverheadItem {
  name: string;
  monthly: number;
}

export interface EngineSettings {
  minMarginPct: number;
  targetMarginPct: number;
  premiumMarginPct: number;
  minNetMarginPct: number;
  materialMarkupPct: number;
  subMarkupPct: number;
  contingencyLowPct: number;
  contingencyMediumPct: number;
  contingencyHighPct: number;
  minServiceCharge: number;
  minBillableHours: number;
  tripCharge: number;
  diagnosticFee: number;
  mileageRate: number;
  defaultRoundTripMiles: number;
  defaultTravelHours: number;
  defaultProcurementHours: number;
  overheadItems: OverheadItem[];
  overheadMethod: OverheadMethod;
  billableTechHoursPerMonth: number;
  jobsPerMonth: number;
  expectedMonthlyRevenue: number;
  hybridPerJobShare: number;
  halfDayHours: number;
  halfDayPrice: number;
  fullDayHours: number;
  fullDayPrice: number;
  taxRatePct: number;
  taxMaterialsOnly: boolean;
  priceRounding: number;
  laborProfiles: LaborProfile[];
}

// ---------------------------------------------------------------------------
// Estimate input — everything needed to recompute an estimate deterministically
// ---------------------------------------------------------------------------

export interface TaskInput {
  id: string;
  name: string;
  description?: string;
  templateKey?: string | null;
  quantity: number;
  unit: string;
  hoursLow: number; // per unit, per technician
  hoursTypical: number;
  hoursHigh: number;
  hoursBasis: HoursBasis;
  customHoursPerUnit?: number | null;
  hoursSource: HoursSource;
  hoursRationale?: string;
  setupHours: number;
  cleanupHours: number;
  crew: Role[]; // each crew member works the task's tech hours
  skill: SkillLevel;
  tradeFlags: TradeFlag[];
  complications: string[];
  dependsOn: string[];
}

export interface MaterialInput {
  id: string;
  materialKey?: string | null;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number | null; // null = no verified price yet → "Price needed"
  source: MaterialSource;
  priceDate?: string | null;
  wastePct: number;
  markupPct?: number | null; // null = use settings default
  customerSupplied: boolean;
  taskId?: string | null;
  notes?: string;
}

export interface OtherCostInput {
  id: string;
  type: OtherCostType;
  description: string;
  amount: number;
}

export interface SubcontractorInput {
  id: string;
  trade: string;
  description: string;
  quotedCost: number;
  markupPct?: number | null;
  licenseRequired: boolean;
  quoteReceived: boolean;
}

export interface TravelInput {
  visits: number;
  roundTripMiles: number;
  travelHoursPerVisit: number; // per crew member
  includeTravelLabor: boolean;
}

export interface RiskInput {
  factors: { key: string; note?: string }[];
  levelOverride?: RiskLevel | null;
  contingencyPctOverride?: number | null;
}

export type ScopeClarity = "CLEAR" | "SOMEWHAT_CLEAR" | "UNCLEAR";

export interface ConfidenceContext {
  photosCount: number;
  dimensionsKnown: boolean;
  siteVisited: boolean;
  scopeClarity: ScopeClarity;
  propertyAgeBand: string; // LT10 | 10_25 | 25_50 | 50_PLUS | UNKNOWN
  similarCompletedJobs: number;
  openQuestions: number;
}

export interface PricingInput {
  selected: Scenario;
  customPrice?: number | null;
}

export interface EstimateInput {
  title: string;
  serviceLine: "ON_DEMAND" | "SENIOR" | "RECURRING";
  tasks: TaskInput[];
  procurementHours: number; // lead tech time to source materials
  materials: MaterialInput[];
  otherCosts: OtherCostInput[];
  subcontractors: SubcontractorInput[];
  travel: TravelInput;
  risk: RiskInput;
  confidence: ConfidenceContext;
  pricing: PricingInput;
  assumptions: string[];
  exclusions: string[];
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface LaborRateBreakdown {
  role: Role;
  name: string;
  wage: number;
  payrollTax: number;
  workersComp: number;
  benefits: number;
  otherBurden: number;
  loadedCost: number;
  billingRate: number;
}

export interface TaskResult {
  id: string;
  name: string;
  hoursPerUnit: number;
  techHours: number; // on-task hours per crew member
  crewHours: number; // techHours × crew size
  laborCost: number;
  billableValue: number;
  byRole: Record<Role, number>; // crew hours per role
}

export interface LaborResult {
  rates: Record<Role, LaborRateBreakdown>;
  tasks: TaskResult[];
  procurement: { hours: number; cost: number };
  travel: { crewHours: number; cost: number };
  hoursByRole: Record<Role, number>;
  onSiteCrewHours: number;
  onSiteDurationHours: number; // elapsed lead hours on site (tasks run sequentially)
  totalCrewHours: number;
  totalCost: number;
  billableValue: number;
}

export interface MaterialLineResult {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  wastePct: number;
  markupPct: number;
  cost: number;
  sellingPrice: number;
  priceMissing: boolean;
  customerSupplied: boolean;
  source: MaterialSource;
  priceDate?: string | null;
}

export interface MaterialsResult {
  lines: MaterialLineResult[];
  totalCost: number;
  totalSelling: number;
  missingPriceCount: number;
}

export interface SubResult {
  id: string;
  trade: string;
  quotedCost: number;
  markupPct: number;
  customerPrice: number;
  licenseRequired: boolean;
  quoteReceived: boolean;
}

export interface DirectCostResult {
  labor: number;
  materials: number;
  equipment: number;
  subcontractors: number;
  disposal: number;
  travel: number; // mileage only — travel labor is inside labor
  permitsFees: number; // permits, parking, tolls
  other: number; // delivery, special order, other
  total: number;
  subs: SubResult[];
  mileageCost: number;
}

export interface OverheadResult {
  method: OverheadMethod;
  monthlyTotal: number;
  fixedPortion: number; // overhead that doesn't depend on price
  pctOfRevenue: number; // portion proportional to price (PCT_REVENUE)
  explanation: string;
}

export interface RiskFactorResult {
  key: string;
  label: string;
  weight: number;
  explanation: string;
  note?: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  computedLevel: RiskLevel;
  contingencyPct: number;
  contingencyAmount: number;
  factors: RiskFactorResult[];
  explanation: string;
}

export interface PriceEvaluation {
  price: number;
  revenue: number;
  directCost: number;
  contingency: number;
  overhead: number;
  fullyLoadedCost: number;
  grossProfit: number; // price − direct cost
  grossMarginPct: number;
  riskAdjustedProfit: number; // price − direct − contingency
  riskAdjustedMarginPct: number;
  netProfit: number; // price − fully loaded cost
  netMarginPct: number;
  revenuePerCrewHour: number;
  guardrail: Guardrail;
  message: string;
}

export interface ScenarioResult extends PriceEvaluation {
  scenario: Scenario;
  label: string;
  targetMarginPct: number;
  appliedFloor: "NONE" | "MIN_SERVICE" | "NET_MARGIN";
  diffFromRecommended: number;
  explanation: string;
}

export interface BundleSuggestion {
  packageName: string;
  packageHours: number;
  packagePrice: number;
  separateCallsPrice: number;
  evaluation: PriceEvaluation;
  reasons: string[];
}

export interface ConfidenceFactor {
  label: string;
  points: number;
}

export interface ConfidenceResult {
  score: number;
  label: "High" | "Medium" | "Low";
  increasing: ConfidenceFactor[];
  decreasing: ConfidenceFactor[];
}

export interface EstimateWarning {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
}

export interface EstimateResult {
  labor: LaborResult;
  materials: MaterialsResult;
  direct: DirectCostResult;
  overhead: OverheadResult;
  risk: RiskResult;
  confidence: ConfidenceResult;
  costBasis: {
    directCost: number;
    contingency: number;
    riskAdjustedDirectCost: number;
    overheadAtRecommended: number;
    fullyLoadedAtRecommended: number;
  };
  rateCardBuildUp: number; // billable labor + materials at selling + subs at markup + other
  minimumCharge: number;
  scenarios: Record<"COMPETITIVE" | "RECOMMENDED" | "PREMIUM", ScenarioResult>;
  quoted: PriceEvaluation & { scenario: Scenario };
  tax: { taxableBase: number; rate: number; amount: number };
  bundle: BundleSuggestion | null;
  licensingReview: { required: boolean; trades: TradeFlag[]; message: string };
  warnings: EstimateWarning[];
  marketNote: string;
}
