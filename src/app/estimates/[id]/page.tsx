import { notFound } from "next/navigation";
import type { ReviewResult } from "@/lib/ai/types";
import { InternalEstimate } from "@/components/estimate/Breakdown";
import { StatusActions } from "@/components/estimate/StatusActions";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, Card, LinkButton, Notice } from "@/components/ui";
import { parseJson } from "@/lib/data";
import { prisma } from "@/lib/db";
import { fmtMoney, fmtPct } from "@/lib/engine/money";
import type { EstimateInput, EstimateResult } from "@/lib/engine/types";
import type { VarianceResult } from "@/lib/engine/variance";
import { can } from "@/lib/role";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

function VarianceTable({ v, showMoney }: { v: VarianceResult; showMoney: boolean }) {
  const rows = showMoney ? [v.laborHours, v.laborCost, v.materials, v.subcontractors, v.other, v.directCost, v.revenue, v.grossProfit] : [v.laborHours];
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="tabular w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 text-left font-medium"></th>
              <th className="text-right font-medium">Estimated</th>
              <th className="text-right font-medium">Actual</th>
              <th className="text-right font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isHours = r.label === "Labor hours";
              const f = (n: number) => (isHours ? `${n.toFixed(1)} h` : fmtMoney(n));
              const bad = ["Revenue", "Gross profit"].includes(r.label) ? r.variance < 0 : r.variance > 0;
              return (
                <tr key={r.label} className="border-t border-line">
                  <td className="py-1.5">{r.label}</td>
                  <td className="text-right">{f(r.estimated)}</td>
                  <td className="text-right">{f(r.actual)}</td>
                  <td className={`text-right font-semibold ${r.variance === 0 ? "" : bad ? "text-red-700" : "text-emerald-700"}`}>
                    {r.variance > 0 ? "+" : ""}
                    {f(r.variance)} {r.estimated ? `(${(r.variancePct * 100).toFixed(0)}%)` : ""}
                  </td>
                </tr>
              );
            })}
            {showMoney && (
              <tr className="border-t border-line font-semibold">
                <td className="py-1.5">Gross margin</td>
                <td className="text-right">{fmtPct(v.grossMargin.estimated)}</td>
                <td className="text-right">{fmtPct(v.grossMargin.actual)}</td>
                <td className={`text-right ${v.grossMargin.variancePts < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {(v.grossMargin.variancePts * 100).toFixed(1)} pts
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">{v.summary}</p>
    </div>
  );
}

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  const perms = can(role);
  const est = await prisma.estimate.findUnique({
    where: { id },
    include: { customer: true, property: true, versions: { orderBy: { version: "desc" } }, photos: true, completedJob: true },
  });
  if (!est || !est.currentVersionId) notFound();
  const version = est.versions.find((v) => v.id === est.currentVersionId)!;
  const input = parseJson<EstimateInput>(version.inputJson, null as unknown as EstimateInput);
  const result = parseJson<EstimateResult>(version.resultJson, null as unknown as EstimateResult);
  const reasoning = parseJson<{ engine?: string; explanation?: string[]; review?: ReviewResult | null; answers?: Record<string, string>; description?: string }>(version.aiReasoningJson, {});
  const variance = est.completedJob ? parseJson<VarianceResult | null>(est.completedJob.resultJson, null) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted">{est.number}</span>
            <StatusBadge status={est.status} />
            <Badge>v{version.version}</Badge>
            {est.isDemo && <Badge tone="amber">Synthetic demo data</Badge>}
          </div>
          <h1 className="mt-1 text-2xl font-bold">{est.title}</h1>
          <p className="text-sm text-muted">
            {est.customer.name} · {est.property.address} {est.property.zip}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/estimates/${est.id}/edit`} variant="secondary">Edit scope</LinkButton>
          {perms.seePricing && <LinkButton href={`/estimates/${est.id}/edit?step=price`} variant="secondary">Adjust price</LinkButton>}
          {perms.seePricing && <LinkButton href={`/estimates/${est.id}/customer`}>Customer estimate</LinkButton>}
          <LinkButton href={`/estimates/${est.id}/actuals`} variant="secondary">{est.completedJob ? "Update actuals" : "Record actuals"}</LinkButton>
        </div>
      </div>
      <StatusActions id={est.id} status={est.status} />

      {variance && (
        <Card title="Estimate vs actual" subtitle={est.completedJob?.varianceReason ? `Reason: ${est.completedJob.varianceReason}` : undefined}>
          <VarianceTable v={variance} showMoney={perms.seeCosts} />
        </Card>
      )}

      <InternalEstimate input={input} result={result} role={role} />

      {reasoning.review && perms.seePricing && (
        <Card title="Saved review" subtitle={`Health ${reasoning.review.health} · ${reasoning.review.engine}`}>
          <p className="text-sm">“{reasoning.review.headline}”</p>
          {reasoning.review.recommendedChanges.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">{reasoning.review.recommendedChanges.map((c, i) => <li key={i}>{c.change}</li>)}</ul>
          )}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Reasoning & data behind this estimate">
          <div className="space-y-2 text-sm">
            <p>Scope engine: <strong>{reasoning.engine ?? "manual"}</strong></p>
            {reasoning.description && <p className="rounded-lg bg-slate-50 p-2 text-slate-700">“{reasoning.description}”</p>}
            {reasoning.explanation?.length ? <ul className="list-disc pl-5 text-slate-700">{reasoning.explanation.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
            {reasoning.answers && Object.keys(reasoning.answers).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted">Customer answers</div>
                <ul className="mt-1 space-y-1">{Object.entries(reasoning.answers).filter(([, a]) => a).map(([q, a]) => <li key={q}><span className="text-muted">{q}</span> — {a}</li>)}</ul>
              </div>
            )}
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-muted">Task hour sources</summary>
              <ul className="mt-2 space-y-2 text-xs">{input.tasks.map((t) => <li key={t.id}><strong>{t.name}:</strong> {t.hoursRationale}</li>)}</ul>
            </details>
          </div>
        </Card>
        <Card title="Versions" subtitle="Every save is preserved.">
          <ul className="divide-y divide-line text-sm">
            {est.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2">
                <span>
                  <strong>v{v.version}</strong> <span className="text-muted">· {v.createdAt.toLocaleString()} · {v.note}</span>
                </span>
                {perms.seePricing && <span className="tabular">{fmtMoney(v.quotedPrice, { cents: false })}{v.priceOverridden && " (manual)"}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {est.photos.length > 0 && (
        <Card title="Photos">
          <div className="flex flex-wrap gap-3">
            {est.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={`/api/photos/${p.id}`} alt="Job photo" className="h-28 w-28 rounded-xl object-cover" />
            ))}
          </div>
        </Card>
      )}
      {est.isDemo && <Notice tone="warning">This estimate is SYNTHETIC DEMO DATA created by the seed script. Prices come from the demo price book, not live market data.</Notice>}
    </div>
  );
}
