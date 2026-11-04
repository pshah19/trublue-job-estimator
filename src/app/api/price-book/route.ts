import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const Body = z.object({
  key: z.string().optional(),
  name: z.string().min(1),
  unit: z.string().min(1),
  category: z.string().default("General"),
  unitCost: z.coerce.number().refine((x) => Number.isFinite(x) && x >= 0),
  source: z.enum(["MANUAL", "RECEIPT", "LOCAL_SUPPLIER", "HOME_DEPOT", "LOWES", "HISTORICAL"]).default("MANUAL"),
  sourceNote: z.string().default(""),
});

/** Add a material, or record a new dated price for an existing one (old prices are kept). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const b = parsed.data;
  const key = b.key || b.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48);
  const material = await prisma.material.upsert({
    where: { key },
    create: { key, name: b.name, unit: b.unit, category: b.category },
    update: { name: b.name, unit: b.unit },
  });
  await prisma.materialPrice.create({
    data: { materialId: material.id, unitCost: b.unitCost, source: b.source, sourceNote: b.sourceNote || "Entered in price book", asOf: new Date() },
  });
  return NextResponse.json({ ok: true, key, asOf: new Date().toISOString().slice(0, 10) });
}
