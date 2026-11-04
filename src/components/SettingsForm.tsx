"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { loadedRate } from "@/lib/engine/labor";
import { fmtMoney } from "@/lib/engine/money";
import { minimumCharge } from "@/lib/engine/pricing";
import type { EngineSettings, LaborProfile, OverheadItem } from "@/lib/engine/types";
import type { PriceEntry } from "@/lib/scope";
import { Badge, Button, Card, Chips, Field, Input, Notice, NumberInput, Select, TextArea, Toggle } from "./ui";

export interface SettingsFormValue {
  companyName: string; companyPhone: string; companyEmail: string; companyAddress: string;
  state: string; territoryZips: string; licensesHeld: string;
  minMarginPct: number; targetMarginPct: number; premiumMarginPct: number; minNetMarginPct: number;
  materialMarkupPct: number; subMarkupPct: number;
  contingencyLowPct: number; contingencyMediumPct: number; contingencyHighPct: number;
  minServiceCharge: number; minBillableHours: number; tripCharge: number; diagnosticFee: number;
  mileageRate: number; defaultRoundTripMiles: number; defaultTravelHours: number; defaultProcurementHours: number;
  overheadItems: OverheadItem[]; overheadMethod: EngineSettings["overheadMethod"];
  billableTechHoursPerMonth: number; jobsPerMonth: number; expectedMonthlyRevenue: number; hybridPerJobShare: number;
  standardWorkdayHours: number; halfDayHours: number; halfDayPrice: number; fullDayHours: number; fullDayPrice: number;
  taxRatePct: number; taxMaterialsOnly: boolean; priceRounding: number;
  paymentTerms: string; warrantyText: string; estimateValidDays: number;
}

function Pct({ label, value, onChange, hint, disabled }: { label: string; value: number; onChange: (n: number) => void; hint?: string; disabled?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <NumberInput suffix="%" disabled={disabled} value={Math.round(value * 10000) / 100} onChange={(n) => onChange((n ?? 0) / 100)} />
    </Field>
  );
}
function Money({ label, value, onChange, hint, disabled }: { label: string; value: number; onChange: (n: number) => void; hint?: string; disabled?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <NumberInput prefix="$" disabled={disabled} value={value} onChange={(n) => onChange(n ?? 0)} />
    </Field>
  );
}
function Num({ label, value, onChange, hint, suffix, disabled }: { label: string; value: number; onChange: (n: number) => void; hint?: string; suffix?: string; disabled?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <NumberInput suffix={suffix} disabled={disabled} value={value} onChange={(n) => onChange(n ?? 0)} />
    </Field>
  );
}

function PriceBook({ priceBook, editable }: { priceBook: PriceEntry[]; editable: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Record<string, number | null>>({});
  const [nw, setNw] = useState({ name: "", unit: "each", unitCost: null as number | null, source: "MANUAL", sourceNote: "" });
  const [msg, setMsg] = useState("");
  const list = priceBook.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const post = async (body: object) => {
    const res = await fetch("/api/price-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    setMsg(res.ok ? `Saved — new dated price recorded (${d.asOf}). Previous prices are kept.` : d.error);
    router.refresh();
  };
  return (
    <Card title="Material price book" subtitle="Every price has a source and date. Live retailer integrations are planned for a later phase — no prices are fetched automatically.">
      <div className="space-y-3">
        <Notice tone="warning">Seeded prices are <strong>synthetic demo values</strong>. Replace them with your supplier pricing or receipts.</Notice>
        {msg && <Notice tone="success">{msg}</Notice>}
        <Input placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-96 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {list.map((p) => (
            <div key={p.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-40 flex-1">{p.name} <span className="text-muted">/ {p.unit}</span></span>
              <Badge tone={p.source === "DEMO_PRICE_BOOK" ? "amber" : "blue"}>{p.source === "DEMO_PRICE_BOOK" ? "demo" : p.source.toLowerCase()} · {p.asOf}</Badge>
              {editable ? (
                <>
                  <NumberInput className="w-28" prefix="$" value={edit[p.key] !== undefined ? edit[p.key] : p.unitCost} onChange={(n) => setEdit({ ...edit, [p.key]: n })} />
                  <Button size="sm" variant="secondary" disabled={edit[p.key] == null || edit[p.key] === p.unitCost} onClick={() => post({ key: p.key, name: p.name, unit: p.unit, category: p.category, unitCost: edit[p.key], source: "MANUAL" })}>
                    Update
                  </Button>
                </>
              ) : (
                <span className="tabular w-20 text-right">{p.unitCost == null ? "—" : fmtMoney(p.unitCost)}</span>
              )}
            </div>
          ))}
        </div>
        {editable && (
          <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_100px_120px_150px_auto]">
            <Input placeholder="New material name" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
            <Input placeholder="Unit" value={nw.unit} onChange={(e) => setNw({ ...nw, unit: e.target.value })} />
            <NumberInput prefix="$" value={nw.unitCost} onChange={(n) => setNw({ ...nw, unitCost: n })} />
            <Select value={nw.source} onChange={(e) => setNw({ ...nw, source: e.target.value })} options={[{ value: "MANUAL", label: "Manual entry" }, { value: "RECEIPT", label: "Receipt / invoice" }, { value: "LOCAL_SUPPLIER", label: "Local supplier quote" }]} />
            <Button size="sm" disabled={!nw.name || nw.unitCost == null} onClick={() => { post({ ...nw }); setNw({ name: "", unit: "each", unitCost: null, source: "MANUAL", sourceNote: "" }); }}>
              Add
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function SettingsForm({ initial, labor, priceBook, editable }: { initial: SettingsFormValue; labor: LaborProfile[]; priceBook: PriceEntry[]; editable: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [lp, setLp] = useState(labor);
  const [msg, setMsg] = useState<{ tone: "success" | "critical"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SettingsFormValue>(k: K, v: SettingsFormValue[K]) => setS({ ...s, [k]: v });
  const d = !editable;
  const monthly = s.overheadItems.reduce((a, i) => a + i.monthly, 0);
  const minCall = useMemo(() => minimumCharge({ ...(s as unknown as EngineSettings), laborProfiles: lp }), [s, lp]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: s, laborProfiles: lp }) });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? { tone: "success", text: "Settings saved. New estimates use these values; saved estimates keep the settings they were calculated with." } : { tone: "critical", text: data.error });
    if (res.ok) router.refresh();
  };

  return (
    <div className="space-y-4 pb-24">
      {!editable && <Notice tone="info">Switch to the Owner / Manager role to edit Business Settings.</Notice>}

      <Card title="Pricing targets" subtitle="Margin, not markup: Price = Cost ÷ (1 − margin). Margins apply to direct cost + contingency.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Pct disabled={d} label="Minimum margin" value={s.minMarginPct} onChange={(v) => set("minMarginPct", v)} hint="Competitive price" />
          <Pct disabled={d} label="Target margin" value={s.targetMarginPct} onChange={(v) => set("targetMarginPct", v)} hint="Recommended price" />
          <Pct disabled={d} label="Premium margin" value={s.premiumMarginPct} onChange={(v) => set("premiumMarginPct", v)} hint="Premium price" />
          <Pct disabled={d} label="Min net margin" value={s.minNetMarginPct} onChange={(v) => set("minNetMarginPct", v)} hint="Floor after overhead" />
          <Pct disabled={d} label="Material markup" value={s.materialMarkupPct} onChange={(v) => set("materialMarkupPct", v)} hint="Rate-card cross-check" />
          <Pct disabled={d} label="Subcontractor markup" value={s.subMarkupPct} onChange={(v) => set("subMarkupPct", v)} />
          <Num disabled={d} label="Round prices up to" value={s.priceRounding} suffix="$" onChange={(v) => set("priceRounding", v)} />
        </div>
      </Card>

      <Card title="Contingency rules" subtitle="Applied to direct job cost by risk level. Always shown on the estimate — never hidden.">
        <div className="grid grid-cols-3 gap-3">
          <Pct disabled={d} label="Low risk" value={s.contingencyLowPct} onChange={(v) => set("contingencyLowPct", v)} />
          <Pct disabled={d} label="Medium risk" value={s.contingencyMediumPct} onChange={(v) => set("contingencyMediumPct", v)} />
          <Pct disabled={d} label="High risk" value={s.contingencyHighPct} onChange={(v) => set("contingencyHighPct", v)} />
        </div>
      </Card>

      <Card title="Minimum service call" subtitle={`Effective minimum: ${fmtMoney(minCall)} = max(minimum charge, min billable hours × lead billing rate + trip charge).`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money disabled={d} label="Minimum service charge" value={s.minServiceCharge} onChange={(v) => set("minServiceCharge", v)} />
          <Num disabled={d} label="Minimum billable hours" value={s.minBillableHours} suffix="h" onChange={(v) => set("minBillableHours", v)} />
          <Money disabled={d} label="Trip charge" value={s.tripCharge} onChange={(v) => set("tripCharge", v)} />
          <Money disabled={d} label="Diagnostic / assessment fee" value={s.diagnosticFee} onChange={(v) => set("diagnosticFee", v)} />
        </div>
      </Card>

      <Card title="Labor profiles" subtitle="Loaded cost = wage + payroll taxes + workers comp + other burden + benefits. Billing rate is separate.">
        <div className="space-y-3">
          {lp.map((p, i) => {
            const r = loadedRate(p);
            const up = (patch: Partial<LaborProfile>) => setLp(lp.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={p.role} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Input className="max-w-xs font-semibold" disabled={d} value={p.name} onChange={(e) => up({ name: e.target.value })} />
                  <Badge tone="blue">Loaded cost {fmtMoney(r.loadedCost)}/h</Badge>
                  <Badge tone="green">Bills {fmtMoney(p.billingRate)}/h</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                  <Money disabled={d} label="Hourly wage" value={p.hourlyWage} onChange={(v) => up({ hourlyWage: v })} />
                  <Pct disabled={d} label="Payroll taxes" value={p.payrollTaxPct} onChange={(v) => up({ payrollTaxPct: v })} />
                  <Pct disabled={d} label="Workers comp" value={p.workersCompPct} onChange={(v) => up({ workersCompPct: v })} />
                  <Money disabled={d} label="Benefits / hr" value={p.benefitsPerHour} onChange={(v) => up({ benefitsPerHour: v })} />
                  <Pct disabled={d} label="Other burden" value={p.otherBurdenPct} onChange={(v) => up({ otherBurdenPct: v })} />
                  <Money disabled={d} label="Billing rate" value={p.billingRate} onChange={(v) => up({ billingRate: v })} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Overhead" subtitle={`Monthly fixed overhead: ${fmtMoney(monthly, { cents: false })}`}>
        <div className="space-y-3">
          {s.overheadItems.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_130px_auto] gap-2">
              <Input disabled={d} value={o.name} onChange={(e) => set("overheadItems", s.overheadItems.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <NumberInput disabled={d} prefix="$" value={o.monthly} onChange={(n) => set("overheadItems", s.overheadItems.map((x, j) => (j === i ? { ...x, monthly: n ?? 0 } : x)))} />
              {editable && <button type="button" className="px-2 text-red-700" onClick={() => set("overheadItems", s.overheadItems.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          {editable && <Button size="sm" variant="ghost" onClick={() => set("overheadItems", [...s.overheadItems, { name: "New expense", monthly: 0 }])}>+ Add expense</Button>}
          <Field label="Allocation method">
            <Chips value={s.overheadMethod} onChange={(v) => !d && set("overheadMethod", v)} options={[{ value: "PER_TECH_HOUR", label: "Per technician hour" }, { value: "PCT_REVENUE", label: "% of revenue" }, { value: "PER_JOB", label: "Per job" }, { value: "HYBRID", label: "Hybrid" }]} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Num disabled={d} label="Billable tech hrs / month" value={s.billableTechHoursPerMonth} onChange={(v) => set("billableTechHoursPerMonth", v)} hint={`= ${fmtMoney(monthly / (s.billableTechHoursPerMonth || 1))}/h`} />
            <Num disabled={d} label="Jobs / month" value={s.jobsPerMonth} onChange={(v) => set("jobsPerMonth", v)} hint={`= ${fmtMoney(monthly / (s.jobsPerMonth || 1))}/job`} />
            <Money disabled={d} label="Expected monthly revenue" value={s.expectedMonthlyRevenue} onChange={(v) => set("expectedMonthlyRevenue", v)} hint={`= ${((monthly / (s.expectedMonthlyRevenue || 1)) * 100).toFixed(1)}% of revenue`} />
            <Pct disabled={d} label="Hybrid: per-job share" value={s.hybridPerJobShare} onChange={(v) => set("hybridPerJobShare", v)} />
          </div>
        </div>
      </Card>

      <Card title="Travel & packages">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money disabled={d} label="Mileage rate / mile" value={s.mileageRate} onChange={(v) => set("mileageRate", v)} />
          <Num disabled={d} label="Default round-trip miles" value={s.defaultRoundTripMiles} onChange={(v) => set("defaultRoundTripMiles", v)} />
          <Num disabled={d} label="Default travel hrs / visit" value={s.defaultTravelHours} suffix="h" onChange={(v) => set("defaultTravelHours", v)} />
          <Num disabled={d} label="Default procurement hrs" value={s.defaultProcurementHours} suffix="h" onChange={(v) => set("defaultProcurementHours", v)} />
          <Num disabled={d} label="Standard workday" value={s.standardWorkdayHours} suffix="h" onChange={(v) => set("standardWorkdayHours", v)} />
          <Num disabled={d} label="Half-day hours" value={s.halfDayHours} suffix="h" onChange={(v) => set("halfDayHours", v)} />
          <Money disabled={d} label="Half-day labor rate" value={s.halfDayPrice} onChange={(v) => set("halfDayPrice", v)} />
          <Num disabled={d} label="Full-day hours" value={s.fullDayHours} suffix="h" onChange={(v) => set("fullDayHours", v)} />
          <Money disabled={d} label="Full-day labor rate" value={s.fullDayPrice} onChange={(v) => set("fullDayPrice", v)} />
        </div>
      </Card>

      <Card title="Tax, territory & licensing" subtitle="Tax rules and permit/licensing requirements vary by jurisdiction — enter what applies to you. The app never assumes them.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Pct disabled={d} label="Sales tax rate" value={s.taxRatePct} onChange={(v) => set("taxRatePct", v)} />
          <div className="sm:col-span-2"><Toggle checked={s.taxMaterialsOnly} onChange={(v) => !d && set("taxMaterialsOnly", v)} label="Tax materials only (not labor)" hint="Check your state's rules." /></div>
          <Field label="State"><Input disabled={d} value={s.state} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="Service territory ZIPs"><Input disabled={d} value={s.territoryZips} onChange={(e) => set("territoryZips", e.target.value)} /></Field>
          <Field label="Licenses held (JSON list)"><Input disabled={d} value={s.licensesHeld} onChange={(e) => set("licensesHeld", e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="Company & customer estimate">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name"><Input disabled={d} value={s.companyName} onChange={(e) => set("companyName", e.target.value)} /></Field>
          <Field label="Phone"><Input disabled={d} value={s.companyPhone} onChange={(e) => set("companyPhone", e.target.value)} /></Field>
          <Field label="Email"><Input disabled={d} value={s.companyEmail} onChange={(e) => set("companyEmail", e.target.value)} /></Field>
          <Field label="Address"><Input disabled={d} value={s.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} /></Field>
          <Num disabled={d} label="Estimate valid for" suffix="days" value={s.estimateValidDays} onChange={(v) => set("estimateValidDays", Math.round(v))} />
        </div>
        <Field label="Payment terms" className="mt-3"><TextArea disabled={d} rows={2} value={s.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></Field>
        <Field label="Warranty" className="mt-3"><TextArea disabled={d} rows={2} value={s.warrantyText} onChange={(e) => set("warrantyText", e.target.value)} /></Field>
      </Card>

      <PriceBook priceBook={priceBook} editable={editable} />

      <Card title="Recurring plan assumptions" subtitle="Home Ally recurring plans arrive in Phase 2. The data model is in place.">
        <p className="text-sm text-muted">No settings yet.</p>
      </Card>

      {editable && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-white/95 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
            {msg && <span className={msg.tone === "success" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{msg.text}</span>}
            <Button className="ml-auto" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
