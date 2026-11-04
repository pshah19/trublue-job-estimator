import { describe, expect, it } from "vitest";
import { PRICE_BOOK } from "@/data/priceBook";
import { TEMPLATES, toTemplateRecord } from "@/data/templates";
import { calculateEstimate } from "../engine/estimate";
import { DEFAULT_ENGINE_SETTINGS } from "../defaults";
import { emptyInput, type PriceEntry } from "../scope";
import { aiScopeToDraft } from "./convert";
import { ruleBasedScope } from "./fallback";

const templates = TEMPLATES.map(toTemplateRecord);
const priceBook: PriceEntry[] = PRICE_BOOK.map((p) => ({
  key: p.key, name: p.name, unit: p.unit, category: p.category, wastePct: p.wastePct ?? 0,
  unitCost: p.unitCost, source: "DEMO_PRICE_BOOK", sourceNote: "", asOf: "2026-10-01",
}));

function draftFor(text: string) {
  const ai = ruleBasedScope(text, templates, 0);
  return aiScopeToDraft({ ai, engine: "rule-based", notice: "", templates, priceBook, history: [] });
}

describe("rule-based scope", () => {
  it("decomposes the fence example", () => {
    const d = draftFor("Replace 6 damaged fence boards and repaint the section");
    expect(d.tasks.map((t) => t.templateKey)).toEqual(["fence_board_replace", "fence_paint"]);
    expect(d.tasks[0].quantity).toBe(6);
    expect(d.questions.some((q) => q.question.includes("linear ft"))).toBe(true); // paint length unknown
    expect(d.otherCosts.some((c) => c.type === "DISPOSAL")).toBe(true);
  });
  it("handles the grab-bar example with number words and tile risk", () => {
    const d = draftFor("Customer wants two grab bars installed in a tiled shower and one handrail installed next to three exterior steps.");
    const keys = d.tasks.map((t) => t.templateKey);
    expect(keys).toContain("grab_bar_install");
    expect(d.tasks.find((t) => t.templateKey === "grab_bar_install")?.quantity).toBe(2);
    expect(d.riskFactors.some((r) => r.key === "TILE_WORK")).toBe(true);
  });
  it("splits a multi-task visit", () => {
    const d = draftFor("Hang mirror, replace bathroom faucet, adjust door that sticks, install shelf");
    expect(d.tasks.length).toBe(4);
  });
  it("asks questions instead of inventing scope for gibberish", () => {
    const d = draftFor("customer wants something looked at in the back");
    expect(d.tasks.length).toBe(0);
    expect(d.needsClarification).toBe(true);
    expect(d.questions.length).toBeGreaterThan(0);
  });
  it("produces a priced estimate end to end", () => {
    const d = draftFor("Replace 6 damaged fence boards and repaint 12 ft of fence");
    const input = { ...emptyInput(DEFAULT_ENGINE_SETTINGS), tasks: d.tasks, materials: d.materials, otherCosts: d.otherCosts, risk: { factors: d.riskFactors } };
    const r = calculateEstimate(input, DEFAULT_ENGINE_SETTINGS);
    expect(r.materials.missingPriceCount).toBe(0);
    expect(r.scenarios.RECOMMENDED.price).toBeGreaterThan(r.direct.total);
  });
});
