import { z } from "zod";
import { OTHER_COST_TYPES, ROLES, TRADE_FLAGS } from "./engine/types";
import type { EstimateInput } from "./engine/types";

const num = z.coerce.number().refine(Number.isFinite, "must be a number");
const nnum = num.transform((n) => Math.max(0, n));

const Task = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  templateKey: z.string().nullable().optional(),
  quantity: nnum,
  unit: z.string(),
  hoursLow: nnum,
  hoursTypical: nnum,
  hoursHigh: nnum,
  hoursBasis: z.enum(["LOW", "TYPICAL", "HIGH", "CUSTOM"]),
  customHoursPerUnit: nnum.nullable().optional(),
  hoursSource: z.enum(["TEMPLATE_ASSUMPTION", "AI_ASSUMPTION", "HISTORY", "USER"]),
  hoursRationale: z.string().optional(),
  setupHours: nnum,
  cleanupHours: nnum,
  crew: z.array(z.enum(ROLES as [string, ...string[]])),
  skill: z.enum(["BASIC", "SKILLED", "ADVANCED"]),
  tradeFlags: z.array(z.enum(TRADE_FLAGS as [string, ...string[]])),
  complications: z.array(z.string()),
  dependsOn: z.array(z.string()),
});

const Material = z.object({
  id: z.string(),
  materialKey: z.string().nullable().optional(),
  name: z.string(),
  quantity: nnum,
  unit: z.string(),
  unitCost: nnum.nullable(),
  source: z.string(),
  priceDate: z.string().nullable().optional(),
  wastePct: nnum,
  markupPct: num.nullable().optional(),
  customerSupplied: z.boolean(),
  taskId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export const EstimateInputSchema = z.object({
  title: z.string(),
  serviceLine: z.enum(["ON_DEMAND", "SENIOR", "RECURRING"]),
  tasks: z.array(Task),
  procurementHours: nnum,
  materials: z.array(Material),
  otherCosts: z.array(z.object({ id: z.string(), type: z.enum(OTHER_COST_TYPES as [string, ...string[]]), description: z.string(), amount: nnum })),
  subcontractors: z.array(
    z.object({ id: z.string(), trade: z.string(), description: z.string(), quotedCost: nnum, markupPct: num.nullable().optional(), licenseRequired: z.boolean(), quoteReceived: z.boolean() }),
  ),
  travel: z.object({ visits: nnum, roundTripMiles: nnum, travelHoursPerVisit: nnum, includeTravelLabor: z.boolean() }),
  risk: z.object({
    factors: z.array(z.object({ key: z.string(), note: z.string().optional() })),
    levelOverride: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable().optional(),
    contingencyPctOverride: nnum.nullable().optional(),
  }),
  confidence: z.object({
    photosCount: nnum,
    dimensionsKnown: z.boolean(),
    siteVisited: z.boolean(),
    scopeClarity: z.enum(["CLEAR", "SOMEWHAT_CLEAR", "UNCLEAR"]),
    propertyAgeBand: z.string(),
    similarCompletedJobs: nnum,
    openQuestions: nnum,
  }),
  pricing: z.object({ selected: z.enum(["COMPETITIVE", "RECOMMENDED", "PREMIUM", "CUSTOM"]), customPrice: nnum.nullable().optional() }),
  assumptions: z.array(z.string()),
  exclusions: z.array(z.string()),
});

export function parseEstimateInput(raw: unknown): EstimateInput {
  return EstimateInputSchema.parse(raw) as EstimateInput;
}

export const CustomerSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().default(""),
  email: z.string().default(""),
  customerType: z.string().default("HOMEOWNER"),
  existing: z.boolean().default(false),
});

export const PropertySchema = z.object({
  id: z.string().optional().nullable(),
  address: z.string().min(1, "Property address is required"),
  zip: z.string().default(""),
  propertyType: z.string().default("SINGLE_FAMILY"),
  ageBand: z.string().default("UNKNOWN"),
  occupied: z.boolean().default(true),
});
