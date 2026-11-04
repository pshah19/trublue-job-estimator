import { NextResponse } from "next/server";
import { z } from "zod";
import { buildScope } from "@/lib/ai/scopeBuilder";
import { loadHistoryStats, loadPriceBook, loadTemplates } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  description: z.string().default(""),
  structured: z.record(z.string(), z.string()).optional(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  photoIds: z.array(z.string()).optional(),
  property: z.object({ propertyType: z.string().optional(), ageBand: z.string().optional(), occupied: z.boolean().optional(), zip: z.string().optional() }).optional(),
  customerType: z.string().optional(),
  estimateId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const [templates, priceBook, history] = await Promise.all([loadTemplates(), loadPriceBook(), loadHistoryStats()]);
  const draft = await buildScope(parsed.data, { templates, priceBook, history });
  return NextResponse.json(draft);
}
