import { notFound } from "next/navigation";
import { ActualsForm } from "@/components/ActualsForm";
import { parseJson } from "@/lib/data";
import { prisma } from "@/lib/db";
import type { EstimateResult, Role } from "@/lib/engine/types";
import { can } from "@/lib/role";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

export default async function ActualsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  const est = await prisma.estimate.findUnique({ where: { id }, include: { completedJob: { include: { labor: true } } } });
  if (!est?.currentVersionId) notFound();
  const v = await prisma.estimateVersion.findUniqueOrThrow({ where: { id: est.currentVersionId } });
  const r = parseJson<EstimateResult>(v.resultJson, null as unknown as EstimateResult);
  const d = r.direct;
  const cj = est.completedJob;
  const hours: Record<Role, number> = { LEAD: 0, TECH: 0, HELPER: 0 };
  cj?.labor.forEach((l) => (hours[l.role as Role] += l.hours));
  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-sm text-muted">{est.number}</p>
        <h1 className="text-2xl font-bold">Record actuals: {est.title}</h1>
        <p className="text-sm text-muted">Closing the loop: estimate → actual → learn. Actuals are compared against version v{v.version}.</p>
      </div>
      <ActualsForm
        estimateId={est.id}
        showMoney={can(role).seeCosts}
        estimated={{ hoursByRole: r.labor.hoursByRole, materials: d.materials, subs: d.subcontractors, other: Math.round((d.equipment + d.disposal + d.travel + d.permitsFees + d.other) * 100) / 100, price: r.quoted.price }}
        initial={cj ? { hours, materialCost: cj.actualMaterialCost, subCost: cj.actualSubCost, otherCost: cj.actualOtherCost, finalRevenue: cj.finalRevenue, changeOrderRevenue: cj.changeOrderRevenue, varianceReason: cj.varianceReason, notes: cj.notes } : undefined}
      />
    </div>
  );
}
