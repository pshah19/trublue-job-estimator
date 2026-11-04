"use client";
import type { ReviewResult } from "@/lib/ai/types";
import { fmtMoney, fmtPct } from "@/lib/engine/money";
import type { EstimateInput, EstimateResult, Scenario } from "@/lib/engine/types";
import { can, type AppRole } from "@/lib/role";
import { Badge, Button, Card, cx, GUARDRAIL_META, GuardrailBadge, Notice, NumberInput, Stat } from "../ui";
import { CostStack, HealthCard, LaborSummary, money, money0, ScenarioCards, Warnings } from "./Breakdown";

type Update = (fn: (d: EstimateInput) => void) => void;

export function ReviewPanel({ review, loading, onRun }: { review: ReviewResult | null; loading: boolean; onRun: () => void }) {
  const tone = review?.health === "RED" ? "red" : review?.health === "YELLOW" ? "amber" : "green";
  return (
    <Card
      title="AI estimate review"
      subtitle="Second-pass check for missed tasks, labor, materials, disposal, permits and margin."
      action={
        <Button size="sm" variant={review ? "secondary" : "primary"} onClick={onRun} disabled={loading}>
          {loading ? "Reviewing…" : review ? "Re-run review" : "Run review"}
        </Button>
      }
    >
      {!review && !loading && <p className="text-sm text-muted">Run the review before sending the estimate.</p>}
      {loading && <p className="text-sm text-muted">Checking the estimate…</p>}
      {review && (
        <div className="space-y-3 text-sm">
          {review.notice && <Notice tone="info">{review.notice}</Notice>}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone}>Estimate health: {review.health}</Badge>
            <Badge tone="slate">Confidence: {review.confidence} ({review.confidenceScore}/100)</Badge>
            <Badge tone={review.engine === "rule-based" ? "slate" : "violet"}>{review.engine === "rule-based" ? "Rule-based" : review.engine}</Badge>
          </div>
          <p className="font-medium">“{review.headline}”</p>
          {review.potentialMissingCosts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted">Potential missing costs</h4>
              <ul className="list-disc pl-5">{review.potentialMissingCosts.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
          {review.mainRisks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted">Main risks</h4>
              <ul className="list-disc pl-5">{review.mainRisks.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
          {review.recommendedChanges.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted">Recommended changes</h4>
              <ul className="space-y-1">
                {review.recommendedChanges.map((c, i) => (
                  <li key={i} className="rounded-lg bg-amber-50 px-3 py-2">
                    <strong>{c.change}</strong>
                    {c.suggestedHoursDelta ? <span className="text-amber-800"> ({c.suggestedHoursDelta > 0 ? "+" : ""}{c.suggestedHoursDelta} h)</span> : null}
                    <div className="text-xs text-slate-600">{c.reason}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">Suggestions are not applied automatically — edit the scope if you agree.</p>
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted">Full checklist ({review.checklist.length})</summary>
            <ul className="mt-2 space-y-1">
              {review.checklist.map((c) => (
                <li key={c.question} className="flex gap-2">
                  <span className={cx("w-16 shrink-0 text-xs font-bold", c.status === "OK" ? "text-emerald-700" : c.status === "CHECK" ? "text-amber-700" : "text-red-700")}>{c.status}</span>
                  <span>
                    {c.question} <span className="text-muted">— {c.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Card>
  );
}

export function PricingStep({
  input,
  result,
  update,
  role,
  review,
  reviewing,
  onReview,
}: {
  input: EstimateInput;
  result: EstimateResult;
  update: Update;
  role: AppRole;
  review: ReviewResult | null;
  reviewing: boolean;
  onReview: () => void;
}) {
  const perms = can(role);
  const q = result.quoted;
  const select = (s: Scenario) => update((d) => { d.pricing = { selected: s, customPrice: null }; });
  const setCustom = (p: number | null) => update((d) => { d.pricing = { selected: "CUSTOM", customPrice: p ?? 0 }; });
  const lo = Math.max(0, Math.floor((Math.min(result.scenarios.COMPETITIVE.price, q.fullyLoadedCost) * 0.7) / 5) * 5);
  const hi = Math.ceil((result.scenarios.PREMIUM.price * 1.35) / 5) * 5;
  const meta = GUARDRAIL_META[q.guardrail];

  if (!perms.seePricing) {
    return (
      <div className="space-y-4">
        <Notice tone="info">Pricing and margin are visible to Owner/Manager and Estimator roles. You can still save the scope.</Notice>
        <Card title="Labor plan"><LaborSummary result={result} role={role} /></Card>
        <Card title="Estimate health"><HealthCard result={result} /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Warnings result={result} />

      <Card title="Price recommendations" subtitle={`${result.marketNote} Margins are calculated on cost — not markup.`}>
        <ScenarioCards result={result} selected={input.pricing.selected === "CUSTOM" ? undefined : input.pricing.selected} onSelect={select} />
        {result.scenarios.RECOMMENDED.appliedFloor === "MIN_SERVICE" && (
          <Notice tone="info" className="mt-3">
            The calculated price is below your {fmtMoney(result.minimumCharge)} minimum service charge, so the minimum is recommended.
          </Notice>
        )}
      </Card>

      <Card title="Adjust the quote" subtitle="Drag or type a price — profitability recalculates instantly.">
        <div className={cx("rounded-2xl border-2 p-4", meta.cls)}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <NumberInput prefix="$" value={q.price} min={0} step="5" onChange={setCustom} className="text-2xl" aria-label="Quoted price" />
            </div>
            <GuardrailBadge g={q.guardrail} long />
            {input.pricing.selected === "CUSTOM" && (
              <Button size="sm" variant="secondary" onClick={() => select("RECOMMENDED")}>
                Reset to recommended
              </Button>
            )}
          </div>
          <input
            type="range"
            min={lo}
            max={hi}
            step={5}
            value={Math.min(hi, Math.max(lo, q.price))}
            onChange={(e) => setCustom(Number(e.target.value))}
            className="mt-4 w-full accent-brand-600"
            aria-label="Price slider"
          />
          <div className="mt-1 flex justify-between text-xs tabular opacity-80">
            <span>{money0(lo)}</span>
            <span>Fully loaded cost {money0(q.fullyLoadedCost)}</span>
            <span>{money0(hi)}</span>
          </div>
          <p className="mt-3 text-sm font-medium">{q.message}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Revenue" value={money0(q.revenue)} />
          <Stat label="Gross profit" value={money(q.grossProfit)} sub={`${fmtPct(q.grossMarginPct)} margin`} />
          <Stat label="Net contribution" value={money(q.netProfit)} sub={`${fmtPct(q.netMarginPct)} after overhead + contingency`} />
          <Stat label="Revenue / crew hr" value={money(q.revenuePerCrewHour)} />
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted">Rate-card cross-check</summary>
          <p className="mt-2 text-muted">
            Billing rates × hours + materials at {fmtPct(result.materials.lines[0]?.markupPct ?? 0)} markup + subs at markup + pass-through costs = <strong className="text-ink">{money(result.rateCardBuildUp)}</strong>. The recommended price is margin-based; this shows what a traditional rate-card build-up would produce.
          </p>
        </details>
      </Card>

      {result.bundle && (
        <Card title={`Bundling opportunity: ${result.bundle.packageName}`} subtitle="Small jobs are inefficient individually.">
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="tabular text-2xl font-black">{money0(result.bundle.packagePrice)}</span>
              <GuardrailBadge g={result.bundle.evaluation.guardrail} />
              <span className="text-muted">gross margin {fmtPct(result.bundle.evaluation.grossMarginPct)} · profit {money(result.bundle.evaluation.grossProfit)}</span>
            </div>
            <ul className="list-disc pl-5 text-slate-700">{result.bundle.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <Button size="sm" variant="secondary" onClick={() => { setCustom(result.bundle!.packagePrice); update((d) => { if (!d.title.toLowerCase().includes("package")) d.title = `${result.bundle!.packageName}: ${d.title}`; }); }}>
              Quote as {result.bundle.packageName}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cost">
          <CostStack result={result} quotedPrice={q.price} />
          <p className="mt-2 text-xs text-muted">Overhead: {result.overhead.explanation}</p>
        </Card>
        <Card title="Labor">
          <LaborSummary result={result} role={role} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Estimate health"><HealthCard result={result} /></Card>
        <ReviewPanel review={review} loading={reviewing} onRun={onReview} />
      </div>
    </div>
  );
}
