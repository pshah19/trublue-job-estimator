import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEngineSettings } from "@/lib/data";
import { prisma } from "@/lib/db";
import { createVersion } from "@/lib/estimates";
import { exportEstimateSafe, removeEstimateFile } from "@/lib/sharedData";
import { parseEstimateInput, PropertySchema, CustomerSchema } from "@/lib/validate";

export const runtime = "nodejs";

const Body = z.object({
  status: z.enum(["DRAFT", "SENT", "WON", "LOST", "COMPLETED"]).optional(),
  input: z.unknown().optional(),
  aiReasoning: z.unknown().optional(),
  note: z.string().optional(),
  customer: CustomerSchema.optional(),
  property: PropertySchema.optional(),
  photoIds: z.array(z.string()).optional(),
});

/** PATCH with `input` creates a NEW version (the original is preserved). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const est = await prisma.estimate.findUnique({ where: { id } });
  if (!est) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = parsed.data;
  if (b.customer) await prisma.customer.update({ where: { id: est.customerId }, data: { name: b.customer.name, phone: b.customer.phone, email: b.customer.email, customerType: b.customer.customerType, existing: b.customer.existing } });
  if (b.property) await prisma.property.update({ where: { id: est.propertyId }, data: { address: b.property.address, zip: b.property.zip, propertyType: b.property.propertyType, ageBand: b.property.ageBand, occupied: b.property.occupied } });
  if (b.input !== undefined) {
    let input;
    try {
      input = parseEstimateInput(b.input);
    } catch (e) {
      return NextResponse.json({ error: `Invalid estimate input: ${(e as Error).message}` }, { status: 400 });
    }
    await createVersion(prisma, { estimateId: id, input, settings: await loadEngineSettings(), aiReasoning: b.aiReasoning, note: b.note ?? "Revised estimate" });
  }
  if (b.photoIds?.length) await prisma.photo.updateMany({ where: { id: { in: b.photoIds } }, data: { estimateId: id } });
  if (b.status) await prisma.estimate.update({ where: { id }, data: { status: b.status } });
  await exportEstimateSafe(prisma, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.estimate.delete({ where: { id } });
  removeEstimateFile(id);
  return NextResponse.json({ ok: true });
}
