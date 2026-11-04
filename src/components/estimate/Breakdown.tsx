"use client";
import { fmtMoney, fmtPct } from "@/lib/engine/money";
import type { EstimateInput, EstimateResult, Role, Scenario, ScenarioResult } from "@/lib/engine/types";
import { can, type AppRole } from "@/lib/role";
import { Badge, Card, cx, GuardrailBadge, Notice, Row, Stat } from "../ui";

const ROLE_NAME: Record<Role, string> = { LEAD: "Lead Tech", TECH: "Technician", HELPER: "Helper" };
export const money = (n: number) => fmtMoney(n);
export const money0 = (n: number) => fmtMoney(n, { cents: false });

export function ScenarioCards({
  result,
  selected,
  onSelect,
}: {
  result: EstimateResult;
  selected?: Scenario;
  onSelect?: (s: Scenario) => void;
}) {
  const list: ScenarioResult[] = [result.scenarios.COMPETITIVE, result.scenarios.RECOMMENDED, result.scenarios.PREMIUM];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {list.map((s) => {
        const rec = s.scenario === "RECOMMENDED";
        const active = selected === s.scenario;
        return (
          <button
            key={s.scenario}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(s.scenario)}
            className={cx(
              "relative rounded-2xl border-2 bg-white p-4 text-left transition",
              rec ? "md:-my-2 md:py-6" : "",
              active ? "border-brand-600 ring-4 ring-brand-100" : rec ? "border-brand-200" : "border-line",
              onSelect && "hover:border-brand-500",
            )}
          >
            {rec && <span className="absolute -top-3 left-4 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">Recommended</span>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-muted">{s.label}</span>
              <GuardrailBadge g={s.guardrail} />
            </div>
            <div className={cx("tabular mt-1 font-black text-ink", rec ? "text-4xl" : "text-3xl")}>{money0(s.price)}</div>
            <div className="mt-3 space-y-0.5 text-sm">
              <Row label="Gross profit" value={money(s.grossProfit)} />
              <Row label="Gross margin" value={fmtPct(s.grossMarginPct)} />
              <Row label="If contingency used" value={fmtPct(s.riskAdjustedMarginPct)} muted />
              <Row label="Net after overhead" value={money(s.netProfit)} muted />
              {s.scenario !== "RECOMMENDED" && (
                <Row label="vs. recommended" value={`${s.diffFromRecommended >= 0 ? "+" : ""}${money0(s.diffFromRecommended)}`} muted />
              )}
              <Row label="Risk" value={result.risk.level} muted />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">{s.explanation}</p>
          </button>
        );
      })}
    </div>
  );
}

export function CostStack({ result, quotedPrice }: { result: EstimateResult; quotedPrice: number }) {
  const d = result.direct;
  return (
    <div className="text-sm">
      <Row label="Labor (loaded cost)" value={money(d.labor)} />
      <Row label="Materials at cost" value={money(d.materials)} />
      {d.equipment > 0 && <Row label="Equipment" value={money(d.equipment)} />}
      {d.subcontractors > 0 && <Row label="Subcontractors" value={money(d.subcontractors)} />}
      <Row label="Disposal" value={money(d.disposal)} />
      <Row label="Travel (mileage)" value={money(d.travel)} />
      {d.permitsFees > 0 && <Row label="Permits / parking / tolls" value={money(d.permitsFees)} />}
      {d.other > 0 && <Row label="Other direct costs" value={money(d.other)} />}
      <div className="my-1 border-t border-line" />
      <Row label="DIRECT JOB COST" value={money(d.total)} strong />
      <Row label={`Allocated overhead (at ${money0(quotedPrice)})`} value={money(result.quoted.overhead)} />
      <Row label={`Contingency — ${result.risk.level} risk, ${fmtPct(result.risk.contingencyPct)}`} value={money(result.risk.contingencyAmount)} />
      <div className="my-1 border-t border-line" />
      <Row label="FULLY LOADED ESTIMATED COST" value={money(result.quoted.fullyLoadedCost)} strong />
    </div>
  );
}

export function LaborSummary({ result, role }: { result: EstimateResult; role: AppRole }) {
  const perms = can(role);
  const l = result.labor;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-3 gap-2">
        {(["LEAD", "TECH", "HELPER"] as Role[])
          .filter((r) => l.hoursByRole[r] > 0)
          .map((r) => (
            <Stat key={r} label={ROLE_NAME[r]} value={`${l.hoursByRole[r].toFixed(2)} h`} />
          ))}
        <Stat label="Total crew hours" value={`${l.totalCrewHours.toFixed(2)} h`} sub={`${l.onSiteDurationHours.toFixed(1)} h on site`} />
      </div>
      <div className="text-xs text-muted">
        Includes {l.procurement.hours.toFixed(2)} h procurement and {l.travel.crewHours.toFixed(2)} h travel.
      </div>
      {perms.seeCosts && (
        <>
          <Row label="Labor cost (loaded)" value={money(l.totalCost)} strong />
          <Row label="Billable labor value (at billing rates — reference only)" value={money(l.billableValue)} muted />
        </>
      )}
      {perms.seeLaborBurden && (
        <details className="rounded-xl bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-muted">Loaded labor rates (cost ≠ billing rate)</summary>
          <table className="mt-2 w-full text-xs tabular">
            <thead className="text-muted">
              <tr>
                <th className="text-left font-medium">Role</th>
                <th className="text-right font-medium">Wage</th>
                <th className="text-right font-medium">Burden</th>
                <th className="text-right font-medium">Loaded</th>
                <th className="text-right font-medium">Bills at</th>
              </tr>
            </thead>
            <tbody>
              {(["LEAD", "TECH", "HELPER"] as Role[]).map((r) => {
                const x = l.rates[r];
                return (
                  <tr key={r}>
                    <td>{ROLE_NAME[r]}</td>
                    <td className="text-right">{money(x.wage)}</td>
                    <td className="text-right">{money(x.payrollTax + x.workersComp + x.otherBurden + x.benefits)}</td>
                    <td className="text-right font-semibold">{money(x.loadedCost)}</td>
                    <td className="text-right">{money(x.billingRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

export function HealthCard({ result }: { result: EstimateResult }) {
  const c = result.confidence;
  const riskTone = result.risk.level === "HIGH" ? "red" : result.risk.level === "MEDIUM" ? "amber" : "green";
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="tabular text-3xl font-black">{c.score}</span>
          <span className="text-muted">/100</span>
        </div>
        <Badge tone={c.label === "High" ? "green" : c.label === "Medium" ? "amber" : "red"}>{c.label} confidence</Badge>
        <Badge tone={riskTone}>Risk: {result.risk.level}</Badge>
      </div>
      <p className="text-xs text-muted">{result.risk.explanation}</p>
      {result.risk.factors.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-muted">Main risks</div>
          <ul className="mt-1 space-y-1">
            {[...result.risk.factors].sort((a, b) => b.weight - a.weight).slice(0, 4).map((f) => (
              <li key={f.key}>
                <span className="font-medium">{f.label}</span>
                <span className="text-muted"> — {f.note || f.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-muted">Why {c.score}? ({c.increasing.length} up / {c.decreasing.length} down)</summary>
        <ul className="mt-2 space-y-0.5 text-xs">
          {c.increasing.map((f) => (
            <li key={f.label} className="text-emerald-700">+{f.points} {f.label}</li>
          ))}
          {c.decreasing.map((f) => (
            <li key={f.label} className="text-red-700">{f.points} {f.label}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function Warnings({ result }: { result: EstimateResult }) {
  return (
    <div className="space-y-2">
      {result.licensingReview.required && (
        <Notice tone="warning">
          <strong>{result.licensingReview.message}</strong>
        </Notice>
      )}
      {result.warnings
        .filter((w) => w.code !== "LOSS" && w.code !== "LOW_MARGIN")
        .map((w) => (
          <Notice key={w.code} tone={w.severity === "critical" ? "critical" : w.severity === "warning" ? "warning" : "info"}>
            {w.message}
          </Notice>
        ))}
    </div>
  );
}

/** Read-only internal estimate (owner/estimator/technician filtered). */
export function InternalEstimate({ input, result, role }: { input: EstimateInput; result: EstimateResult; role: AppRole }) {
  const perms = can(role);
  const q = result.quoted;
  return (
    <div className="space-y-4">
      <Warnings result={result} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Scope">
          <ol className="space-y-2 text-sm">
            {input.tasks.map((t, i) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">
                    {i + 1}. {t.name}
                  </span>
                  <span className="text-muted"> · {t.quantity} {t.unit}</span>
                </span>
                <span className="tabular shrink-0 text-muted">{result.labor.tasks[i]?.crewHours.toFixed(2)} crew h</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Labor">
          <LaborSummary result={result} role={role} />
        </Card>
        <Card title="Materials" subtitle={perms.seeCosts ? `Cost ${money(result.materials.totalCost)} · selling ${money(result.materials.totalSelling)}` : undefined}>
          <ul className="space-y-1 text-sm">
            {result.materials.lines.map((m) => (
              <li key={m.id} className="flex justify-between gap-3">
                <span>
                  {m.name} <span className="text-muted">× {m.quantity} {m.unit}</span>
                  {m.customerSupplied && <Badge className="ml-1">customer-supplied</Badge>}
                  {m.priceMissing && <Badge tone="red" className="ml-1">price needed</Badge>}
                </span>
                {perms.seeCosts && <span className="tabular text-muted">{money(m.cost)}</span>}
              </li>
            ))}
            {!result.materials.lines.length && <li className="text-muted">No materials.</li>}
          </ul>
        </Card>
        {perms.seeCosts && (
          <Card title="Cost">
            <CostStack result={result} quotedPrice={q.price} />
          </Card>
        )}
      </div>
      {perms.seePricing && (
        <Card title="Pricing" subtitle={result.marketNote}>
          <ScenarioCards result={result} selected={q.scenario === "CUSTOM" ? undefined : q.scenario} />
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Stat label="Quoted price" value={money0(q.price)} sub={q.scenario === "CUSTOM" ? "Manual price" : q.scenario.toLowerCase()} />
            <Stat label="Gross profit" value={money(q.grossProfit)} sub={fmtPct(q.grossMarginPct)} />
            <Stat label="Net after overhead & contingency" value={money(q.netProfit)} sub={fmtPct(q.netMarginPct)} />
            <Stat label="Revenue / crew hour" value={money(q.revenuePerCrewHour)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <GuardrailBadge g={q.guardrail} long />
            <span className="text-muted">{q.message}</span>
          </div>
        </Card>
      )}
      <Card title="Estimate health">
        <HealthCard result={result} />
      </Card>
    </div>
  );
}
