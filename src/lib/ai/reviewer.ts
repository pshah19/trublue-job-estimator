import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { prisma } from "../db";
import type { EstimateInput, EstimateResult } from "../engine/types";
import { ruleBasedReview } from "../review";
import { AI_MODEL, describeAiError, getClient, isAiAvailable } from "./client";
import { REVIEW_SYSTEM } from "./prompts";
import { AiReviewSchema } from "./schemas";
import type { ReviewResult } from "./types";

const RANK = { GREEN: 0, YELLOW: 1, RED: 2 } as const;

function compact(input: EstimateInput, r: EstimateResult) {
  return {
    title: input.title,
    tasks: input.tasks.map((t, i) => ({
      name: t.name,
      description: t.description,
      quantity: t.quantity,
      unit: t.unit,
      hoursPerUnit: r.labor.tasks[i]?.hoursPerUnit,
      techHours: r.labor.tasks[i]?.techHours,
      crew: t.crew,
      hoursSource: t.hoursSource,
      setupHours: t.setupHours,
      cleanupHours: t.cleanupHours,
      tradeFlags: t.tradeFlags,
      complications: t.complications,
    })),
    procurementHours: input.procurementHours,
    travel: input.travel,
    materials: r.materials.lines.map((m) => ({ name: m.name, qty: m.quantity, unit: m.unit, priced: !m.priceMissing, customerSupplied: m.customerSupplied })),
    otherCosts: input.otherCosts.map((c) => ({ type: c.type, description: c.description, amount: c.amount })),
    subcontractors: input.subcontractors,
    risk: { level: r.risk.level, contingencyPct: r.risk.contingencyPct, factors: r.risk.factors.map((f) => f.label) },
    confidence: r.confidence,
    figures: {
      directCost: r.direct.total,
      laborCost: r.direct.labor,
      materialCost: r.direct.materials,
      contingency: r.risk.contingencyAmount,
      quotedPrice: r.quoted.price,
      grossMarginPct: Number((r.quoted.grossMarginPct * 100).toFixed(1)),
      riskAdjustedMarginPct: Number((r.quoted.riskAdjustedMarginPct * 100).toFixed(1)),
      netProfit: r.quoted.netProfit,
      guardrail: r.quoted.guardrail,
      totalCrewHours: r.labor.totalCrewHours,
    },
    assumptions: input.assumptions,
    exclusions: input.exclusions,
  };
}

export async function reviewEstimate(input: EstimateInput, result: EstimateResult, estimateId?: string | null): Promise<ReviewResult> {
  const base = ruleBasedReview(input, result);
  if (!isAiAvailable()) {
    return { ...base, notice: "AI review not configured (no ANTHROPIC_API_KEY) — showing the standard rule-based checklist." };
  }
  try {
    const msg = await getClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(AiReviewSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: `Review this estimate:\n${JSON.stringify(compact(input, result), null, 1)}` }],
    });
    const ai = msg.stop_reason === "refusal" ? null : msg.parsed_output;
    if (!ai) return { ...base, notice: "AI review unavailable for this request — showing the rule-based checklist." };
    await prisma.aiRun.create({
      data: { kind: "REVIEW", engine: msg.model ?? AI_MODEL, estimateId: estimateId ?? null, inputJson: JSON.stringify(compact(input, result)), outputJson: JSON.stringify(ai) },
    });
    const health = RANK[ai.health] >= RANK[base.health] ? ai.health : base.health;
    return {
      engine: msg.model ?? AI_MODEL,
      notice: "",
      health,
      confidence: result.confidence.label, // the deterministic score is authoritative
      confidenceScore: result.confidence.score,
      headline: ai.headline,
      potentialMissingCosts: [...new Set([...base.potentialMissingCosts, ...ai.potentialMissingCosts])],
      mainRisks: ai.mainRisks.length ? ai.mainRisks : base.mainRisks,
      recommendedChanges: [...ai.recommendedChanges, ...base.recommendedChanges],
      checklist: ai.checklist.length ? ai.checklist : base.checklist,
    };
  } catch (e) {
    return { ...base, notice: `${describeAiError(e)} Showing the rule-based checklist.` };
  }
}
