import { NextResponse } from "next/server";
import { reviewEstimate } from "@/lib/ai/reviewer";
import { loadEngineSettings } from "@/lib/data";
import { calculateEstimate } from "@/lib/engine/estimate";
import { parseEstimateInput } from "@/lib/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json();
  let input;
  try {
    input = parseEstimateInput(body.input);
  } catch (e) {
    return NextResponse.json({ error: `Invalid estimate input: ${(e as Error).message}` }, { status: 400 });
  }
  const settings = await loadEngineSettings();
  const result = calculateEstimate(input, settings); // server recomputes — never trusts client numbers
  const review = await reviewEstimate(input, result, body.estimateId ?? null);
  return NextResponse.json(review);
}
