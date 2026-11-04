import { notFound } from "next/navigation";
import { CustomerEstimate } from "@/components/CustomerEstimate";
import { PrintButton } from "@/components/PrintButton";
import { LinkButton, Notice } from "@/components/ui";
import { loadCustomerDoc } from "@/lib/customerDoc";
import { can } from "@/lib/role";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

export default async function CustomerEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (!can(role).seePricing) return <Notice tone="info">Customer estimates are available to Owner/Manager and Estimator roles.</Notice>;
  const doc = await loadCustomerDoc(id);
  if (!doc) notFound();
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <LinkButton href={`/estimates/${id}`} variant="secondary">← Internal view</LinkButton>
        <a href={`/api/estimates/${id}/pdf`} className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Download PDF
        </a>
        <PrintButton />
        <span className="text-xs text-muted">Customer view — internal costs, margins and risk scores are not included.</span>
      </div>
      <CustomerEstimate doc={doc} />
    </div>
  );
}
