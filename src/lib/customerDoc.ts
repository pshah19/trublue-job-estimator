import "server-only";
import { loadBusinessSettings, parseJson } from "./data";
import { prisma } from "./db";
import type { EstimateInput, EstimateResult } from "./engine/types";

/**
 * Customer-safe estimate document. This is the ONLY data the customer HTML/PDF views receive,
 * so internal costs, wages, markup, profit, margin, overhead and risk scores cannot leak.
 */
export interface CustomerDoc {
  company: { name: string; phone: string; email: string; address: string };
  number: string;
  date: string;
  validUntil: string;
  customer: { name: string; phone: string; email: string };
  property: { address: string; zip: string };
  title: string;
  scope: { name: string; detail: string; quantity: string }[];
  materials: { name: string; quantity: string; customerSupplied: boolean }[];
  price: number;
  tax: number;
  total: number;
  packageName: string | null;
  duration: string;
  paymentTerms: string;
  assumptions: string[];
  exclusions: string[];
  warranty: string;
  licensingNote: string | null;
  isDemo: boolean;
}

function duration(hours: number, visits: number, workday: number): string {
  const v = visits > 1 ? ` over ${visits} visits` : "";
  if (hours <= workday) return `Approximately ${Math.max(1, Math.round(hours * 2) / 2)} hours on site${v}.`;
  return `Approximately ${Math.ceil(hours / workday)} working days${v}.`;
}

export async function loadCustomerDoc(estimateId: string): Promise<CustomerDoc | null> {
  const est = await prisma.estimate.findUnique({ where: { id: estimateId }, include: { customer: true, property: true } });
  if (!est?.currentVersionId) return null;
  const v = await prisma.estimateVersion.findUniqueOrThrow({ where: { id: est.currentVersionId } });
  const input = parseJson<EstimateInput>(v.inputJson, null as unknown as EstimateInput);
  const r = parseJson<EstimateResult>(v.resultJson, null as unknown as EstimateResult);
  const s = await loadBusinessSettings();
  const date = v.createdAt;
  const valid = new Date(date.getTime() + s.estimateValidDays * 86400000);
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return {
    company: { name: s.companyName, phone: s.companyPhone, email: s.companyEmail, address: s.companyAddress },
    number: est.number,
    date: fmtDate(date),
    validUntil: fmtDate(valid),
    customer: { name: est.customer.name, phone: est.customer.phone, email: est.customer.email },
    property: { address: est.property.address, zip: est.property.zip },
    title: est.title,
    scope: input.tasks.map((t) => ({ name: t.name, detail: t.description ?? "", quantity: `${t.quantity} ${t.unit}` })),
    materials: input.materials.map((m) => ({ name: m.name, quantity: `${m.quantity} ${m.unit}`, customerSupplied: m.customerSupplied })),
    price: r.quoted.price,
    tax: r.tax.amount,
    total: Math.round((r.quoted.price + r.tax.amount) * 100) / 100,
    packageName: /package/i.test(est.title) ? est.title.split(":")[0] : null,
    duration: duration(r.labor.onSiteDurationHours, input.travel.visits, s.standardWorkdayHours),
    paymentTerms: s.paymentTerms,
    assumptions: input.assumptions,
    exclusions: input.exclusions,
    warranty: s.warrantyText,
    licensingNote: r.licensingReview.required
      ? "Some work may require a licensed trade or permit depending on local requirements. If so, we will advise you before proceeding and any associated fees will be quoted separately."
      : null,
    isDemo: est.isDemo,
  };
}
