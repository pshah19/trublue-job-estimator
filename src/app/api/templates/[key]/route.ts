import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const n = z.coerce.number().refine(Number.isFinite).transform((x) => Math.max(0, x));
const Body = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  lowHoursPerUnit: n,
  typicalHoursPerUnit: n,
  highHoursPerUnit: n,
  setupHours: n,
  cleanupHours: n,
  crew: z.array(z.enum(["LEAD", "TECH", "HELPER"])).min(1),
  markValidated: z.boolean().default(false),
});

/** Owner edits a template. Marking it validated clears the "Needs validation" flag. */
export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const b = parsed.data;
  if (!(b.lowHoursPerUnit <= b.typicalHoursPerUnit && b.typicalHoursPerUnit <= b.highHoursPerUnit))
    return NextResponse.json({ error: "Hours must satisfy low ≤ typical ≤ high." }, { status: 400 });
  await prisma.jobTemplate.update({
    where: { key },
    data: {
      name: b.name,
      unit: b.unit,
      lowHoursPerUnit: b.lowHoursPerUnit,
      typicalHoursPerUnit: b.typicalHoursPerUnit,
      highHoursPerUnit: b.highHoursPerUnit,
      setupHours: b.setupHours,
      cleanupHours: b.cleanupHours,
      crew: JSON.stringify(b.crew),
      source: "OWNER_EDITED",
      ...(b.markValidated ? { needsValidation: false, validationNote: `Validated by owner on ${new Date().toISOString().slice(0, 10)}.` } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
