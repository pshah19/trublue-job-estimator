import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordActuals } from "@/lib/estimates";
import { exportEstimateSafe } from "@/lib/sharedData";

export const runtime = "nodejs";

const n = z.coerce.number().refine(Number.isFinite).transform((x) => Math.max(0, x));
const Body = z.object({
  laborHours: z.array(z.object({ role: z.enum(["LEAD", "TECH", "HELPER"]), hours: n })),
  materialCost: n,
  subCost: n,
  otherCost: n,
  finalRevenue: n,
  changeOrderRevenue: n.default(0),
  varianceReason: z.string().default(""),
  notes: z.string().default(""),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const est = await prisma.estimate.findUnique({ where: { id } });
  if (!est?.currentVersionId) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  const { variance } = await recordActuals(prisma, { estimateId: id, actuals: parsed.data });
  await exportEstimateSafe(prisma, id);
  return NextResponse.json({ ok: true, variance });
}
