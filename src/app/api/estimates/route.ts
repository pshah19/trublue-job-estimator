import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEngineSettings, nextEstimateNumber } from "@/lib/data";
import { prisma } from "@/lib/db";
import { createVersion } from "@/lib/estimates";
import { exportEstimateSafe } from "@/lib/sharedData";
import { CustomerSchema, parseEstimateInput, PropertySchema } from "@/lib/validate";

export const runtime = "nodejs";

const Body = z.object({
  customer: CustomerSchema,
  property: PropertySchema,
  input: z.unknown(),
  aiReasoning: z.unknown().optional(),
  photoIds: z.array(z.string()).optional(),
  aiRunIds: z.array(z.string()).optional(),
});

export async function GET() {
  const rows = await prisma.estimate.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  let input;
  try {
    input = parseEstimateInput(parsed.data.input);
  } catch (e) {
    return NextResponse.json({ error: `Invalid estimate input: ${(e as Error).message}` }, { status: 400 });
  }
  const { customer: c, property: p } = parsed.data;
  const settings = await loadEngineSettings();

  const customer = c.id
    ? await prisma.customer.update({ where: { id: c.id }, data: { name: c.name, phone: c.phone, email: c.email, customerType: c.customerType, existing: c.existing } })
    : await prisma.customer.create({ data: { name: c.name, phone: c.phone, email: c.email, customerType: c.customerType, existing: c.existing } });
  const propData = { address: p.address, zip: p.zip, propertyType: p.propertyType, ageBand: p.ageBand, occupied: p.occupied };
  const property = p.id
    ? await prisma.property.update({ where: { id: p.id }, data: propData })
    : await prisma.property.create({ data: { ...propData, customerId: customer.id } });

  const estimate = await prisma.estimate.create({
    data: {
      number: await nextEstimateNumber(),
      title: input.title || "Untitled estimate",
      serviceLineId: input.serviceLine,
      customerId: customer.id,
      propertyId: property.id,
    },
  });
  await createVersion(prisma, { estimateId: estimate.id, input, settings, aiReasoning: parsed.data.aiReasoning, note: "Initial estimate" });
  if (parsed.data.photoIds?.length) await prisma.photo.updateMany({ where: { id: { in: parsed.data.photoIds } }, data: { estimateId: estimate.id } });
  if (parsed.data.aiRunIds?.length) await prisma.aiRun.updateMany({ where: { id: { in: parsed.data.aiRunIds } }, data: { estimateId: estimate.id } });
  await exportEstimateSafe(prisma, estimate.id);
  return NextResponse.json({ id: estimate.id, number: estimate.number });
}
