import { z } from "zod";
import { RISK_FACTORS } from "../engine/riskCatalog";

// Structured outputs the LLM may return. Note: NO dollar amounts anywhere —
// the AI recommends inputs (tasks, hours, quantities, risks); the engine computes money.

const RiskKey = z.enum(RISK_FACTORS.map((r) => r.key) as [string, ...string[]]);
const Role = z.enum(["LEAD", "TECH", "HELPER"]);
const Trade = z.enum(["ELECTRICAL", "PLUMBING", "HVAC", "STRUCTURAL", "PERMIT", "MAJOR_REMODEL"]);

export const AiScopeSchema = z.object({
  jobTitle: z.string().describe("Short job title for the estimate"),
  summary: z.string().describe("One or two sentences restating what we are promising to do"),
  scopeClarity: z.enum(["CLEAR", "SOMEWHAT_CLEAR", "UNCLEAR"]),
  needsClarification: z
    .boolean()
    .describe("True when missing information could materially change the price"),
  tasks: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      templateKey: z.string().nullable().describe("Exact key from the template catalog, or null if none fits"),
      quantity: z.number(),
      unit: z.string(),
      hoursPerUnitLow: z.number().describe("Only used when templateKey is null"),
      hoursPerUnitTypical: z.number(),
      hoursPerUnitHigh: z.number(),
      setupHours: z.number(),
      cleanupHours: z.number(),
      crew: z.array(Role),
      skill: z.enum(["BASIC", "SKILLED", "ADVANCED"]),
      tradeFlags: z.array(Trade),
      complications: z.array(z.string()),
      dependsOn: z.array(z.string()).describe("Names of tasks that must happen first"),
      hoursRationale: z.string().describe("Why these hours/crew were chosen; say if it is an assumption"),
    }),
  ),
  materials: z.array(
    z.object({
      name: z.string(),
      priceBookKey: z.string().nullable().describe("Exact key from the price book, or null if not listed"),
      quantity: z.number(),
      unit: z.string(),
      forTask: z.string().nullable(),
      customerSupplied: z.boolean(),
      notes: z.string(),
    }),
  ),
  otherCosts: z.array(
    z.object({
      type: z.enum(["EQUIPMENT", "PERMIT", "PARKING", "TOLLS", "DISPOSAL", "DELIVERY", "SPECIAL_ORDER", "OTHER"]),
      description: z.string(),
    }),
  ),
  subcontractors: z.array(z.object({ trade: z.string(), reason: z.string(), licenseLikely: z.boolean() })),
  riskFactors: z.array(z.object({ key: RiskKey, reason: z.string() })),
  photoFindings: z.array(
    z.object({
      photoIndex: z.number(),
      observed: z.array(z.string()).describe("Directly visible facts"),
      inferred: z.array(z.string()).describe("Reasonable inferences, labeled as such"),
      unknown: z.array(z.string()).describe("Things that cannot be determined from the photo"),
    }),
  ),
  questions: z.array(
    z.object({
      question: z.string(),
      whyItMatters: z.string(),
      priceImpact: z.enum(["HIGH", "MEDIUM", "LOW"]),
    }),
  ),
  assumptions: z.array(z.string()),
  exclusions: z.array(z.string()),
});
export type AiScope = z.infer<typeof AiScopeSchema>;

export const AiReviewSchema = z.object({
  health: z.enum(["GREEN", "YELLOW", "RED"]),
  confidence: z.enum(["High", "Medium", "Low"]),
  headline: z.string().describe("One-sentence overall assessment"),
  potentialMissingCosts: z.array(z.string()),
  mainRisks: z.array(z.string()),
  recommendedChanges: z.array(
    z.object({
      change: z.string(),
      reason: z.string(),
      suggestedHoursDelta: z.number().nullable().describe("Suggested labor hours to add (+) or remove (−), if applicable"),
    }),
  ),
  checklist: z.array(
    z.object({
      question: z.string(),
      status: z.enum(["OK", "CHECK", "MISSING"]),
      note: z.string(),
    }),
  ),
});
export type AiReview = z.infer<typeof AiReviewSchema>;
