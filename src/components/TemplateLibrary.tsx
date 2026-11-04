"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Role } from "@/lib/engine/types";
import type { HistoryStat, TemplateRecord } from "@/lib/scope";
import { Badge, Button, Card, cx, Field, Input, Notice, NumberInput } from "./ui";

function Editor({ t, stat, editable, onDone }: { t: TemplateRecord; stat?: HistoryStat; editable: boolean; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: t.name, unit: t.unit, low: t.lowHoursPerUnit, typ: t.typicalHoursPerUnit, high: t.highHoursPerUnit, setup: t.setupHours, cleanup: t.cleanupHours, crew: t.crew });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestion = stat ? Math.round(t.typicalHoursPerUnit * stat.ratio * 100) / 100 : null;
  const save = async (markValidated: boolean) => {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/templates/${t.key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.name, unit: f.unit, lowHoursPerUnit: f.low, typicalHoursPerUnit: f.typ, highHoursPerUnit: f.high, setupHours: f.setup, cleanupHours: f.cleanup, crew: f.crew, markValidated }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Save failed");
    onDone();
    router.refresh();
  };
  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-3">
      {stat && (
        <Notice tone="info">
          Based on {stat.completedJobs} completed job(s) that used this template, actual crew hours averaged <strong>{Math.round(stat.ratio * 100)}%</strong> of estimate ({stat.avgActualCrewHours} h actual vs {stat.avgEstimatedCrewHours} h estimated, whole job). Suggested typical: <strong>{suggestion} h/{t.unit}</strong>. This is a recommendation only.
          {editable && suggestion != null && (
            <button type="button" className="ml-2 font-semibold underline" onClick={() => setF({ ...f, typ: suggestion, low: Math.min(f.low, suggestion), high: Math.max(f.high, suggestion) })}>
              Use suggestion
            </button>
          )}
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={f.name} disabled={!editable} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Unit"><Input value={f.unit} disabled={!editable} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Field label="Low h/unit"><NumberInput value={f.low} disabled={!editable} step="0.05" onChange={(n) => setF({ ...f, low: n ?? 0 })} /></Field>
        <Field label="Typical"><NumberInput value={f.typ} disabled={!editable} step="0.05" onChange={(n) => setF({ ...f, typ: n ?? 0 })} /></Field>
        <Field label="High"><NumberInput value={f.high} disabled={!editable} step="0.05" onChange={(n) => setF({ ...f, high: n ?? 0 })} /></Field>
        <Field label="Setup h"><NumberInput value={f.setup} disabled={!editable} step="0.05" onChange={(n) => setF({ ...f, setup: n ?? 0 })} /></Field>
        <Field label="Cleanup h"><NumberInput value={f.cleanup} disabled={!editable} step="0.05" onChange={(n) => setF({ ...f, cleanup: n ?? 0 })} /></Field>
      </div>
      <Field label="Default crew">
        <div className="flex gap-2">
          {(["LEAD", "TECH", "HELPER"] as Role[]).map((r) => {
            const on = f.crew.includes(r);
            return (
              <button key={r} type="button" disabled={!editable} onClick={() => setF({ ...f, crew: on ? f.crew.filter((x) => x !== r) : [...f.crew, r] })} className={cx("min-h-10 rounded-full border px-3 text-sm font-medium", on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white")}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="text-xs text-muted">
        <div><strong>Complications:</strong> {t.complications.join(" · ") || "—"}</div>
        <div><strong>Typical materials:</strong> {t.materials.map((m) => m.materialKey.replace(/_/g, " ")).join(", ") || "—"}</div>
      </div>
      {err && <Notice tone="critical">{err}</Notice>}
      {editable ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => save(false)} disabled={busy}>Save</Button>
          <Button size="sm" variant="secondary" onClick={() => save(true)} disabled={busy}>Save & mark validated</Button>
          <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only the Owner role can edit templates.</p>
      )}
    </div>
  );
}

export function TemplateLibrary({ templates, history, editable }: { templates: TemplateRecord[]; history: HistoryStat[]; editable: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const hmap = new Map(history.map((h) => [h.templateKey, h]));
  const groups = useMemo(() => {
    const g = new Map<string, TemplateRecord[]>();
    templates
      .filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.keywords.some((k) => k.includes(q.toLowerCase())))
      .forEach((t) => g.set(t.categoryName, [...(g.get(t.categoryName) ?? []), t]));
    return [...g.entries()];
  }, [templates, q]);
  const unvalidated = templates.filter((t) => t.needsValidation).length;

  return (
    <div className="space-y-4">
      <Notice tone="warning">
        {unvalidated} of {templates.length} templates still use <strong>initial assumptions — validate with actual TruBlue job history.</strong> Seed labor times are placeholders, not industry standards.
      </Notice>
      <Input placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map(([cat, list]) => (
        <Card key={cat} title={cat} subtitle={`${list.length} template(s)${list[0].serviceLineId !== "ON_DEMAND" ? " · Phase 2 service line (usable in on-demand estimates)" : ""}`}>
          <ul className="space-y-2">
            {list.map((t) => (
              <li key={t.key}>
                <button type="button" onClick={() => setOpen(open === t.key ? null : t.key)} className="flex w-full flex-wrap items-center gap-2 text-left">
                  <span className="flex-1 font-medium">{t.name}</span>
                  <span className="tabular text-sm text-muted">{t.lowHoursPerUnit}–{t.highHoursPerUnit} h / {t.unit}</span>
                  {t.needsValidation ? <Badge tone="amber">Needs validation</Badge> : <Badge tone="green">Validated</Badge>}
                  {hmap.get(t.key) && <Badge tone="blue">{hmap.get(t.key)!.completedJobs} completed</Badge>}
                  {t.tradeFlags.length > 0 && <Badge tone="orange">{t.tradeFlags.join(", ").toLowerCase()}</Badge>}
                </button>
                {open === t.key && <div className="mt-2"><Editor t={t} stat={hmap.get(t.key)} editable={editable} onDone={() => setOpen(null)} /></div>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
