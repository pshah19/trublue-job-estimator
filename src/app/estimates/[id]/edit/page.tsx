import { notFound } from "next/navigation";
import type { ScopeDraft } from "@/lib/ai/types";
import { Wizard } from "@/components/estimate/Wizard";
import { isAiAvailable } from "@/lib/ai/client";
import { loadEngineSettings, loadHistoryStats, loadPriceBook, loadTemplates, parseJson } from "@/lib/data";
import { prisma } from "@/lib/db";
import type { EstimateInput } from "@/lib/engine/types";
import { loadCustomerOptions } from "@/lib/pageData";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

export default async function EditEstimatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step } = await searchParams;
  const est = await prisma.estimate.findUnique({ where: { id }, include: { customer: true, property: true, photos: true } });
  if (!est?.currentVersionId) notFound();
  const version = await prisma.estimateVersion.findUniqueOrThrow({ where: { id: est.currentVersionId } });
  const [role, settings, templates, priceBook, history, customers] = await Promise.all([
    getRole(), loadEngineSettings(), loadTemplates(), loadPriceBook(), loadHistoryStats(), loadCustomerOptions(),
  ]);
  const reasoning = parseJson<Record<string, unknown>>(version.aiReasoningJson, {});
  const draft: ScopeDraft | null = reasoning.explanation
    ? ({
        engine: String(reasoning.engine ?? "rule-based"),
        notice: "",
        jobTitle: est.title,
        summary: String(reasoning.summary ?? ""),
        scopeClarity: "CLEAR",
        needsClarification: false,
        tasks: [], materials: [], otherCosts: [], subcontractors: [], riskFactors: [],
        photoFindings: (reasoning.photoFindings as ScopeDraft["photoFindings"]) ?? [],
        questions: (reasoning.questions as ScopeDraft["questions"]) ?? [],
        assumptions: [], exclusions: [], dimensionsKnown: true,
        explanation: (reasoning.explanation as string[]) ?? [],
      } satisfies ScopeDraft)
    : null;
  return (
    <Wizard
      role={role}
      settings={settings}
      templates={templates}
      priceBook={priceBook}
      history={history}
      customers={customers}
      aiAvailable={isAiAvailable()}
      initial={{
        step: step === "price" ? 5 : 4,
        estimateId: est.id,
        number: est.number,
        customer: { id: est.customer.id, name: est.customer.name, phone: est.customer.phone, email: est.customer.email, customerType: est.customer.customerType, existing: est.customer.existing },
        property: { id: est.property.id, address: est.property.address, zip: est.property.zip, propertyType: est.property.propertyType, ageBand: est.property.ageBand, occupied: est.property.occupied },
        input: parseJson<EstimateInput>(version.inputJson, null as unknown as EstimateInput),
        draft,
        answers: (reasoning.answers as Record<string, string>) ?? {},
        photos: est.photos.map((p) => ({ id: p.id, url: `/api/photos/${p.id}` })),
        description: String(reasoning.description ?? ""),
      }}
    />
  );
}
