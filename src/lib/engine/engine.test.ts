import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_SETTINGS as S } from "../defaults";
import {
  calculateEstimate,
  computeMaterials,
  computeOverhead,
  computeVariance,
  evaluatePrice,
  loadedRate,
  marginToMarkup,
  markupToMargin,
  minimumCharge,
  priceForMargin,
  roundUpTo,
  type EngineSettings,
  type EstimateInput,
} from "./index";

function baseInput(over: Partial<EstimateInput> = {}): EstimateInput {
  return {
    title: "Test",
    serviceLine: "ON_DEMAND",
    tasks: [
      {
        id: "t1",
        name: "Install grab bar",
        templateKey: "grab_bar",
        quantity: 2,
        unit: "each",
        hoursLow: 0.75,
        hoursTypical: 1,
        hoursHigh: 1.5,
        hoursBasis: "TYPICAL",
        hoursSource: "TEMPLATE_ASSUMPTION",
        setupHours: 0.25,
        cleanupHours: 0.25,
        crew: ["LEAD"],
        skill: "SKILLED",
        tradeFlags: [],
        complications: [],
        dependsOn: [],
      },
    ],
    procurementHours: 0,
    materials: [
      { id: "m1", name: "Grab bar", quantity: 2, unit: "each", unitCost: 40, source: "DEMO_PRICE_BOOK", wastePct: 0, customerSupplied: false },
    ],
    otherCosts: [],
    subcontractors: [],
    travel: { visits: 1, roundTripMiles: 20, travelHoursPerVisit: 0.5, includeTravelLabor: true },
    risk: { factors: [] },
    confidence: {
      photosCount: 1,
      dimensionsKnown: true,
      siteVisited: false,
      scopeClarity: "CLEAR",
      propertyAgeBand: "10_25",
      similarCompletedJobs: 0,
      openQuestions: 0,
    },
    pricing: { selected: "RECOMMENDED" },
    assumptions: [],
    exclusions: [],
    ...over,
  };
}

describe("margin vs markup", () => {
  it("prices $600 at 40% margin as $1,000", () => {
    expect(priceForMargin(600, 0.4)).toBe(1000);
  });
  it("converts markup and margin correctly", () => {
    expect(markupToMargin(0.4)).toBeCloseTo(0.2857, 4);
    expect(marginToMarkup(0.4)).toBeCloseTo(0.6667, 4);
  });
  it("rounds prices up, never down", () => {
    expect(roundUpTo(1001, 5)).toBe(1005);
    expect(roundUpTo(1000, 5)).toBe(1000);
  });
});

describe("labor", () => {
  it("computes loaded cost separately from billing rate", () => {
    const r = loadedRate(S.laborProfiles[0]);
    // 32 + 9.65% + 6% + 3% of wage + 3.50 benefits
    expect(r.loadedCost).toBeCloseTo(32 + 3.09 + 1.92 + 0.96 + 3.5, 2);
    expect(r.billingRate).toBe(110);
    expect(r.loadedCost).toBeLessThan(r.billingRate);
  });
  it("computes task hours = setup + qty × hrs/unit + cleanup", () => {
    const res = calculateEstimate(baseInput(), S);
    expect(res.labor.tasks[0].techHours).toBe(2.5);
    // + 0.5 travel hrs for the lead
    expect(res.labor.totalCrewHours).toBe(3);
  });
  it("multiplies crew hours by crew size", () => {
    const input = baseInput();
    input.tasks[0].crew = ["LEAD", "HELPER"];
    const res = calculateEstimate(input, S);
    expect(res.labor.tasks[0].crewHours).toBe(5);
    expect(res.labor.hoursByRole.HELPER).toBe(3); // 2.5 task + 0.5 travel
  });
});

describe("materials", () => {
  it("applies waste then markup", () => {
    const m = computeMaterials(
      [{ id: "x", name: "Boards", quantity: 10, unit: "ea", unitCost: 5, source: "MANUAL", wastePct: 0.1, customerSupplied: false }],
      S,
    );
    expect(m.lines[0].cost).toBe(55);
    expect(m.lines[0].sellingPrice).toBe(71.5);
  });
  it("flags unpriced materials and never invents a price", () => {
    const m = computeMaterials(
      [{ id: "x", name: "Mystery part", quantity: 1, unit: "ea", unitCost: null, source: "UNPRICED", wastePct: 0, customerSupplied: false }],
      S,
    );
    expect(m.missingPriceCount).toBe(1);
    expect(m.lines[0].cost).toBe(0);
  });
});

describe("overhead", () => {
  const monthly = S.overheadItems.reduce((a, b) => a + b.monthly, 0);
  it("per tech hour", () => {
    const o = computeOverhead(S, 10);
    expect(o.fixedPortion).toBeCloseTo((monthly / 320) * 10, 2);
  });
  it("percent of revenue", () => {
    const o = computeOverhead({ ...S, overheadMethod: "PCT_REVENUE" }, 10);
    expect(o.pctOfRevenue).toBeCloseTo(monthly / 45000, 6);
    expect(o.fixedPortion).toBe(0);
  });
  it("per job", () => {
    const o = computeOverhead({ ...S, overheadMethod: "PER_JOB" }, 10);
    expect(o.fixedPortion).toBeCloseTo(monthly / 40, 2);
  });
});

describe("pricing scenarios & guardrails", () => {
  it("recommended hits the target margin on risk-adjusted cost", () => {
    const input = baseInput({ tasks: [{ ...baseInput().tasks[0], quantity: 6 }] });
    const res = calculateEstimate(input, S);
    const rec = res.scenarios.RECOMMENDED;
    expect(rec.appliedFloor).toBe("NONE");
    expect(rec.riskAdjustedMarginPct).toBeGreaterThanOrEqual(S.targetMarginPct - 1e-9);
    expect(rec.riskAdjustedMarginPct).toBeLessThan(S.targetMarginPct + 0.01);
    expect(res.scenarios.COMPETITIVE.price).toBeLessThan(rec.price);
    expect(res.scenarios.PREMIUM.price).toBeGreaterThan(rec.price);
  });
  it("applies the minimum service charge to tiny jobs", () => {
    const input = baseInput({
      tasks: [{ ...baseInput().tasks[0], quantity: 1, hoursTypical: 0.25, setupHours: 0, cleanupHours: 0.1 }],
      materials: [],
      travel: { visits: 1, roundTripMiles: 0, travelHoursPerVisit: 0, includeTravelLabor: false },
    });
    const res = calculateEstimate(input, S);
    expect(res.scenarios.COMPETITIVE.appliedFloor).toBe("MIN_SERVICE");
    expect(res.scenarios.COMPETITIVE.price).toBe(minimumCharge(S));
  });
  it("flags a price below fully loaded cost as LOSS", () => {
    const res = calculateEstimate(baseInput({ pricing: { selected: "CUSTOM", customPrice: 50 } }), S);
    expect(res.quoted.guardrail).toBe("LOSS");
    expect(res.warnings.some((w) => w.code === "LOSS")).toBe(true);
  });
  it("evaluates gross vs risk-adjusted vs net margin consistently", () => {
    const res = calculateEstimate(baseInput({ risk: { factors: [{ key: "TILE_WORK" }, { key: "HIDDEN_BEHIND_WALLS" }] } }), S);
    expect(res.risk.level).toBe("MEDIUM");
    const ev = evaluatePrice(1000, { directCost: res.direct.total, contingency: res.risk.contingencyAmount, overhead: res.overhead, crewHours: res.labor.totalCrewHours }, S);
    expect(ev.grossProfit).toBeCloseTo(1000 - res.direct.total, 2);
    expect(ev.riskAdjustedProfit).toBeCloseTo(1000 - res.direct.total - res.risk.contingencyAmount, 2);
    expect(ev.netProfit).toBeCloseTo(ev.riskAdjustedProfit - ev.overhead, 2);
    expect(ev.grossMarginPct).toBeGreaterThan(ev.riskAdjustedMarginPct);
  });
  it("is deterministic", () => {
    const a = calculateEstimate(baseInput(), S);
    const b = calculateEstimate(baseInput(), S);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it("suggests a bundle for 3+ small tasks", () => {
    const t = baseInput().tasks[0];
    const input = baseInput({
      tasks: [
        { ...t, id: "a", quantity: 1, hoursTypical: 0.5 },
        { ...t, id: "b", quantity: 1, hoursTypical: 0.5 },
        { ...t, id: "c", quantity: 1, hoursTypical: 0.5 },
      ],
    });
    const res = calculateEstimate(input, S);
    expect(res.bundle?.packageName).toBe("Half-Day Handyman Package");
  });
  it("raises licensing review for plumbing tasks", () => {
    const input = baseInput();
    input.tasks[0].tradeFlags = ["PLUMBING"];
    expect(calculateEstimate(input, S).licensingReview.required).toBe(true);
  });
});

describe("variance", () => {
  it("computes labor and margin variance", () => {
    const settings: EngineSettings = S;
    const est = calculateEstimate(baseInput(), settings);
    const v = computeVariance(
      est,
      { laborHours: [{ role: "LEAD", hours: 4 }], materialCost: 90, subCost: 0, otherCost: 14, finalRevenue: est.quoted.price, changeOrderRevenue: 0 },
      settings,
    );
    expect(v.laborHours.estimated).toBe(3);
    expect(v.laborHours.actual).toBe(4);
    expect(v.laborHours.variance).toBe(1);
    expect(v.grossMargin.actual).toBeLessThan(v.grossMargin.estimated);
  });
});
