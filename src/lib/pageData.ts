import "server-only";
import { prisma } from "./db";
import type { CustomerOption } from "@/components/estimate/StepsIntro";

export async function loadCustomerOptions(): Promise<CustomerOption[]> {
  const rows = await prisma.customer.findMany({ include: { properties: true }, orderBy: { name: "asc" } });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    customerType: c.customerType,
    existing: c.existing,
    properties: c.properties.map((p) => ({ id: p.id, address: p.address, zip: p.zip, propertyType: p.propertyType, ageBand: p.ageBand, occupied: p.occupied })),
  }));
}
