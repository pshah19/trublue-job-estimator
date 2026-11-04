import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, LinkButton } from "@/components/ui";
import { cx } from "@/lib/cx";
import { parseJson } from "@/lib/data";
import { prisma } from "@/lib/db";
import { fmtMoney, fmtPct } from "@/lib/engine/money";
import type { EstimateResult } from "@/lib/engine/types";
import { can } from "@/lib/role";
import { getRole } from "@/lib/serverRole";

export const dynamic = "force-dynamic";
const FILTERS = ["ALL", "DRAFT", "SENT", "WON", "LOST", "COMPLETED"];

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "ALL", q = "" } = await searchParams;
  const role = await getRole();
  const perms = can(role);
  const rows = await prisma.estimate.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { number: { contains: q } }, { customer: { name: { contains: q } } }] } : {}),
    },
    include: { customer: true, property: true },
    orderBy: { createdAt: "desc" },
  });
  const versions = await prisma.estimateVersion.findMany({ where: { id: { in: rows.map((r) => r.currentVersionId!).filter(Boolean) } } });
  const vmap = new Map(versions.map((v) => [v.id, v]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estimates</h1>
        <LinkButton href="/estimates/new">+ New estimate</LinkButton>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search customer, title or number…" className="min-h-11 flex-1 rounded-xl border border-line bg-white px-3" />
        <input type="hidden" name="status" value={status} />
        <button className="rounded-xl border border-line bg-white px-4 font-semibold">Search</button>
      </form>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {FILTERS.map((f) => (
          <Link key={f} href={`/estimates?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold", status === f ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white")}>
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {rows.map((e) => {
          const v = e.currentVersionId ? vmap.get(e.currentVersionId) : undefined;
          const r = v ? parseJson<EstimateResult | null>(v.resultJson, null) : null;
          return (
            <Link key={e.id} href={`/estimates/${e.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-muted">{e.number}</span>
                  <StatusBadge status={e.status} />
                  {e.isDemo && <Badge tone="amber">Synthetic demo</Badge>}
                </div>
                <div className="truncate font-semibold">{e.title}</div>
                <div className="truncate text-sm text-muted">
                  {e.customer.name} · {e.property.address}
                </div>
              </div>
              {perms.seePricing && r && (
                <div className="tabular flex items-center gap-4 text-right sm:block">
                  <div className="text-lg font-bold">{fmtMoney(r.quoted.price, { cents: false })}</div>
                  <div className="text-xs text-muted">{fmtPct(r.quoted.grossMarginPct)} gross margin</div>
                </div>
              )}
            </Link>
          );
        })}
        {!rows.length && <div className="p-8 text-center text-muted">No estimates found.</div>}
      </div>
    </div>
  );
}
