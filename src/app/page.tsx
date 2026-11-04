import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, Card, LinkButton, Notice } from "@/components/ui";
import { isAiAvailable } from "@/lib/ai/client";
import { loadEngineSettings, parseJson } from "@/lib/data";
import { prisma } from "@/lib/db";
import { fmtMoney, fmtPct } from "@/lib/engine/money";
import type { EstimateResult } from "@/lib/engine/types";
import type { VarianceResult } from "@/lib/engine/variance";
import { can } from "@/lib/role";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <div className="tabular mt-1 text-2xl font-black">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const role = await getRole();
  const perms = can(role);
  const settings = await loadEngineSettings();
  const ests = await prisma.estimate.findMany({ include: { customer: true, completedJob: true }, orderBy: { createdAt: "desc" } });
  const versions = await prisma.estimateVersion.findMany({ where: { id: { in: ests.map((e) => e.currentVersionId!).filter(Boolean) } } });
  const vmap = new Map(versions.map((v) => [v.id, v]));
  const rows = ests.map((e) => {
    const v = e.currentVersionId ? vmap.get(e.currentVersionId) : undefined;
    return { e, r: v ? parseJson<EstimateResult | null>(v.resultJson, null) : null };
  });

  const won = rows.filter((x) => ["WON", "COMPLETED"].includes(x.e.status));
  const decided = rows.filter((x) => ["WON", "COMPLETED", "LOST"].includes(x.e.status));
  const quoted = rows.reduce((a, x) => a + (x.r?.quoted.price ?? 0), 0);
  const wonRev = won.reduce((a, x) => a + (x.r?.quoted.price ?? 0), 0);
  const avgGM = rows.length ? rows.reduce((a, x) => a + (x.r?.quoted.grossMarginPct ?? 0), 0) / rows.length : 0;
  const completed = rows.filter((x) => x.e.completedJob);
  const variances = completed.map((x) => parseJson<VarianceResult | null>(x.e.completedJob!.resultJson, null)).filter(Boolean) as VarianceResult[];
  const actualGM = variances.length ? variances.reduce((a, v) => a + v.grossMargin.actual, 0) / variances.length : null;
  const estH = variances.reduce((a, v) => a + v.laborHours.estimated, 0);
  const actH = variances.reduce((a, v) => a + v.laborHours.actual, 0);
  const estM = variances.reduce((a, v) => a + v.materials.estimated, 0);
  const actM = variances.reduce((a, v) => a + v.materials.actual, 0);
  const belowTarget = rows.filter((x) => x.r && x.r.quoted.riskAdjustedMarginPct < settings.targetMarginPct - 1e-6);
  const revPerHour = won.reduce((a, x) => a + (x.r?.labor.totalCrewHours ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted">Estimate → Quote → Win/Loss → Execute → Actual → Learn</p>
        </div>
        <LinkButton href="/estimates/new" size="lg">+ New estimate</LinkButton>
      </div>
      {!isAiAvailable() && (
        <Notice tone="info">
          AI is not configured — scope building uses the rule-based template matcher and photos aren&apos;t analyzed. Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> to enable Claude.
        </Notice>
      )}
      {rows.some((x) => x.e.isDemo) && <Notice tone="warning">Includes SYNTHETIC DEMO DATA from the seed script. Demo prices are placeholders, not market data.</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Estimates created" value={String(rows.length)} sub={`${won.length} won · ${rows.filter((x) => x.e.status === "LOST").length} lost`} />
        <Kpi label="Conversion rate" value={decided.length ? fmtPct(won.length / decided.length) : "—"} sub="won ÷ decided" />
        {perms.seePricing && <Kpi label="Quoted revenue" value={fmtMoney(quoted, { cents: false })} sub={`Won ${fmtMoney(wonRev, { cents: false })}`} />}
        {perms.seePricing && <Kpi label="Avg job value" value={rows.length ? fmtMoney(quoted / rows.length, { cents: false }) : "—"} />}
        {perms.seePricing && <Kpi label="Avg quoted gross margin" value={fmtPct(avgGM)} sub={`Target ${fmtPct(settings.targetMarginPct)} on risk-adj. cost`} />}
        {perms.seePricing && <Kpi label="Actual gross margin" value={actualGM == null ? "—" : fmtPct(actualGM)} sub={`${variances.length} completed job(s)`} />}
        <Kpi label="Actual vs est. labor" value={estH ? `${actH.toFixed(1)} h` : "—"} sub={estH ? `vs ${estH.toFixed(1)} h estimated (${((actH / estH - 1) * 100).toFixed(0)}%)` : undefined} />
        {perms.seeCosts && <Kpi label="Actual vs est. materials" value={estM ? fmtMoney(actM, { cents: false }) : "—"} sub={estM ? `vs ${fmtMoney(estM, { cents: false })} estimated` : undefined} />}
        {perms.seePricing && <Kpi label="Revenue / tech hour (won)" value={revPerHour ? fmtMoney(wonRev / revPerHour) : "—"} />}
        {perms.seePricing && <Kpi label="Below margin target" value={String(belowTarget.length)} sub="estimates under target" />}
      </div>

      <Card title="Recent estimates" action={<Link href="/estimates" className="text-sm font-semibold text-brand-700">View all</Link>}>
        <ul className="divide-y divide-line">
          {rows.slice(0, 8).map(({ e, r }) => (
            <li key={e.id}>
              <Link href={`/estimates/${e.id}`} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate font-medium">{e.title}</span><StatusBadge status={e.status} /></div>
                  <div className="truncate text-xs text-muted">{e.number} · {e.customer.name}</div>
                </div>
                {perms.seePricing && r && <span className="tabular font-semibold">{fmtMoney(r.quoted.price, { cents: false })}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {completed.length > 0 && (
        <Card title="Completed jobs — what did we learn?" subtitle="Recommendations only. Templates are never changed without owner approval.">
          <ul className="divide-y divide-line text-sm">
            {completed.map(({ e }) => {
              const v = parseJson<VarianceResult | null>(e.completedJob!.resultJson, null);
              if (!v) return null;
              const over = v.laborHours.variancePct;
              return (
                <li key={e.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <Link href={`/estimates/${e.id}`} className="min-w-0 flex-1 font-medium hover:underline">{e.title}</Link>
                  <Badge tone={Math.abs(over) < 0.1 ? "green" : over > 0 ? "red" : "blue"}>
                    Labor {over > 0 ? "+" : ""}{(over * 100).toFixed(0)}%
                  </Badge>
                  {perms.seePricing && <span className="tabular text-muted">GM {fmtPct(v.grossMargin.actual)} (est. {fmtPct(v.grossMargin.estimated)})</span>}
                  <span className="text-xs text-muted">{e.completedJob!.varianceReason}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
