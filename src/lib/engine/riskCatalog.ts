// Risk factor catalog. Each factor explains WHY it affects the estimate.
// Weights feed a simple additive score → LOW / MEDIUM / HIGH. Contingency % per level
// is configured in Business Settings, and the estimator can override both.

export interface RiskFactorDef {
  key: string;
  label: string;
  weight: number;
  explanation: string;
}

export const RISK_FACTORS: RiskFactorDef[] = [
  { key: "OLD_PROPERTY", label: "Older property (50+ yrs)", weight: 2, explanation: "Older homes often have out-of-square framing, non-standard sizes, plaster walls and prior repairs that slow work and change material needs." },
  { key: "UNKNOWN_CONDITIONS", label: "Unknown existing conditions", weight: 3, explanation: "The condition of what we are repairing hasn't been verified; real scope may be larger once work starts." },
  { key: "HIDDEN_BEHIND_WALLS", label: "Work hidden behind walls/floors", weight: 3, explanation: "Framing, blocking, wiring or pipes inside walls can't be seen until opened and may require extra work." },
  { key: "PLUMBING_ELECTRICAL", label: "Plumbing/electrical dependency", weight: 3, explanation: "Connections to existing systems can reveal corroded valves, old wiring or code issues that add time or require a licensed trade." },
  { key: "TILE_WORK", label: "Drilling or working in tile", weight: 2, explanation: "Tile can crack while drilling; slow, careful drilling and replacement-tile risk add time and cost." },
  { key: "STRUCTURAL", label: "Structural uncertainty", weight: 4, explanation: "Rot, undersized members or missing supports can turn a repair into a structural project." },
  { key: "MATERIAL_AVAILABILITY", label: "Material availability", weight: 2, explanation: "Special-order or hard-to-match materials can require extra trips, delays or substitutions." },
  { key: "CUSTOMER_SUPPLIED", label: "Customer-supplied materials", weight: 2, explanation: "Customer-supplied items may be wrong, damaged or missing parts, causing return trips we can't bill as materials." },
  { key: "PERMIT_REQUIRED", label: "Permit may be required", weight: 2, explanation: "Permits add fees, inspection scheduling and possible rework to meet inspector requirements." },
  { key: "SUB_DEPENDENCY", label: "Subcontractor dependency", weight: 2, explanation: "Schedule and cost depend on a third party; quotes can change and coordination takes time." },
  { key: "DIFFICULT_ACCESS", label: "Difficult access", weight: 2, explanation: "Tight spaces, crawlspaces, long carries or limited parking reduce productivity." },
  { key: "WORKING_AT_HEIGHT", label: "Working at height", weight: 2, explanation: "Ladders/scaffolding slow work, may need a second person for safety, and raise equipment needs." },
  { key: "UNCLEAR_SCOPE", label: "Unclear scope", weight: 3, explanation: "The customer request isn't specific enough to know exactly what we're promising — scope creep risk." },
  { key: "WATER_DAMAGE", label: "Potential water damage", weight: 3, explanation: "Water damage often extends beyond what's visible (rot, mold, subfloor) and can expand the job." },
  { key: "DETERIORATION", label: "Existing deterioration", weight: 2, explanation: "Rotted or failing adjacent material may not hold fasteners and may need replacing too." },
  { key: "OCCUPIED_WORKSPACE", label: "Occupied workspace", weight: 1, explanation: "Working around occupants, pets and furniture requires extra protection, setup and cleanup." },
  { key: "COMPLEX_DEMOLITION", label: "Complex demolition", weight: 3, explanation: "Demolition can uncover surprises and generates disposal volume that's hard to predict." },
];

export const RISK_BY_KEY: Record<string, RiskFactorDef> = Object.fromEntries(RISK_FACTORS.map((r) => [r.key, r]));

export const RISK_THRESHOLDS = { mediumAt: 4, highAt: 8 };
