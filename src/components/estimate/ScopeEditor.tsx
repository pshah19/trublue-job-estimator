"use client";
import { useState } from "react";
import type { ScopeDraft } from "@/lib/ai/types";
import { fmtMoney, fmtPct } from "@/lib/engine/money";
import { RISK_FACTORS } from "@/lib/engine/riskCatalog";
import type { EstimateInput, EstimateResult, HoursBasis, OtherCostType, Role, TaskInput } from "@/lib/engine/types";
import { OTHER_COST_TYPES } from "@/lib/engine/types";
import { can, type AppRole } from "@/lib/role";
import { materialFromPrice, taskFromTemplate, uid, unpricedMaterial, type PriceEntry, type TemplateRecord } from "@/lib/scope";
import { Badge, Button, Card, Chips, cx, Field, Input, Notice, NumberInput, Select, SourceBadge, TextArea, Toggle } from "../ui";

type Update = (fn: (d: EstimateInput) => void) => void;
const ROLE_SHORT: Record<Role, string> = { LEAD: "Lead", TECH: "Tech", HELPER: "Helper" };
const today = () => new Date().toISOString().slice(0, 10);

function CrewEditor({ crew, onChange }: { crew: Role[]; onChange: (c: Role[]) => void }) {
  const count = (r: Role) => crew.filter((x) => x === r).length;
  const set = (r: Role, n: number) => {
    const others = crew.filter((x) => x !== r);
    const next = [...others, ...Array.from({ length: Math.max(0, n) }, () => r)];
    const order: Role[] = ["LEAD", "TECH", "HELPER"];
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    onChange(next.length ? next : ["LEAD"]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {(["LEAD", "TECH", "HELPER"] as Role[]).map((r) => (
        <div key={r} className="flex items-center gap-1 rounded-xl border border-line bg-white px-1">
          <button type="button" className="h-9 w-8 text-lg font-bold text-muted" onClick={() => set(r, count(r) - 1)} aria-label={`Remove ${r}`}>−</button>
          <span className="min-w-12 text-center text-sm font-medium">{count(r)} {ROLE_SHORT[r]}</span>
          <button type="button" className="h-9 w-8 text-lg font-bold text-brand-600" onClick={() => set(r, count(r) + 1)} aria-label={`Add ${r}`}>+</button>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, index, result, update, role }: { task: TaskInput; index: number; result: EstimateResult; update: Update; role: AppRole }) {
  const [open, setOpen] = useState(false);
  const tr = result.labor.tasks[index];
  const perms = can(role);
  const set = (fn: (t: TaskInput) => void, markUser = false) =>
    update((d) => {
      const t = d.tasks.find((x) => x.id === task.id);
      if (!t) return;
      fn(t);
      if (markUser) t.hoursSource = "USER";
    });
  const basisOpts: { value: HoursBasis; label: string }[] = [
    { value: "LOW", label: `Low ${task.hoursLow}` },
    { value: "TYPICAL", label: `Typical ${task.hoursTypical}` },
    { value: "HIGH", label: `High ${task.hoursHigh}` },
    { value: "CUSTOM", label: "Custom" },
  ];
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{index + 1}</span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="min-w-0 flex-1 font-semibold" value={task.name} onChange={(e) => set((t) => (t.name = e.target.value))} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={task.hoursSource} />
            {task.tradeFlags.map((f) => (
              <Badge key={f} tone="orange">{f.toLowerCase().replace("_", " ")}</Badge>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
            <Field label={`Qty (${task.unit})`} className="max-w-40">
              <NumberInput value={task.quantity} min={0} onChange={(n) => set((t) => (t.quantity = n ?? 0))} />
            </Field>
            <Field label="Hours per unit, per tech">
              <Chips value={task.hoursBasis} onChange={(v) => set((t) => { t.hoursBasis = v; if (v === "CUSTOM" && t.customHoursPerUnit == null) t.customHoursPerUnit = t.hoursTypical; }, true)} options={basisOpts} />
            </Field>
          </div>
          {task.hoursBasis === "CUSTOM" && (
            <Field label="Custom hours per unit" className="max-w-48">
              <NumberInput value={task.customHoursPerUnit ?? task.hoursTypical} min={0} step="0.05" suffix="h" onChange={(n) => set((t) => (t.customHoursPerUnit = n ?? 0), true)} />
            </Field>
          )}
          <Field label="Crew (each works the task hours)">
            <CrewEditor crew={task.crew} onChange={(c) => set((t) => (t.crew = c), true)} />
          </Field>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="tabular"><strong>{tr?.techHours.toFixed(2)}</strong> h on task</span>
            <span className="tabular"><strong>{tr?.crewHours.toFixed(2)}</strong> crew h</span>
            {perms.seeCosts && <span className="tabular text-muted">labor cost {fmtMoney(tr?.laborCost ?? 0)}</span>}
            <button type="button" className="ml-auto text-sm font-semibold text-brand-700" onClick={() => setOpen(!open)}>
              {open ? "Less" : "Details"}
            </button>
          </div>
          {open && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Setup hours">
                  <NumberInput value={task.setupHours} min={0} step="0.05" onChange={(n) => set((t) => (t.setupHours = n ?? 0), true)} />
                </Field>
                <Field label="Cleanup hours">
                  <NumberInput value={task.cleanupHours} min={0} step="0.05" onChange={(n) => set((t) => (t.cleanupHours = n ?? 0), true)} />
                </Field>
              </div>
              <Field label="Description">
                <TextArea rows={2} value={task.description ?? ""} onChange={(e) => set((t) => (t.description = e.target.value))} />
              </Field>
              {task.hoursRationale && <p className="text-xs text-muted"><strong>Why these hours:</strong> {task.hoursRationale}</p>}
              {task.complications.length > 0 && (
                <div className="text-xs">
                  <strong>Likely complications:</strong> {task.complications.join(" · ")}
                </div>
              )}
              {task.dependsOn.length > 0 && <div className="text-xs"><strong>Depends on:</strong> {task.dependsOn.join(", ")}</div>}
              <Button variant="danger" size="sm" onClick={() => update((d) => { d.tasks = d.tasks.filter((t) => t.id !== task.id); d.materials = d.materials.filter((m) => m.taskId !== task.id || !m.materialKey); })}>
                Remove task
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScopeEditor({
  input,
  result,
  update,
  role,
  draft,
  answers,
  setAnswers,
  onRefine,
  refining,
  templates,
  priceBook,
  photos,
}: {
  input: EstimateInput;
  result: EstimateResult;
  update: Update;
  role: AppRole;
  draft: ScopeDraft | null;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  onRefine: () => void;
  refining: boolean;
  templates: TemplateRecord[];
  priceBook: PriceEntry[];
  photos: { id: string; url: string }[];
}) {
  const perms = can(role);
  const [addTpl, setAddTpl] = useState("");
  const [addMat, setAddMat] = useState("");
  const pmap = new Map(priceBook.map((p) => [p.key, p]));
  const selectedRisk = new Set(input.risk.factors.map((f) => f.key));

  return (
    <div className="space-y-4">
      {draft && (
        <Card
          title={draft.jobTitle || "Scope"}
          subtitle={draft.summary}
          action={<Badge tone={draft.engine === "rule-based" ? "slate" : "violet"}>{draft.engine === "rule-based" ? "Rule-based" : `AI · ${draft.engine}`}</Badge>}
        >
          <div className="space-y-3">
            {draft.notice && <Notice tone="warning">{draft.notice}</Notice>}
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {draft.explanation.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {draft.photoFindings.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Photo findings</h3>
                {draft.photoFindings.map((f) => {
                  const ph = photos[f.photoIndex];
                  return (
                    <div key={f.photoIndex} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {ph && <img src={ph.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
                      <div className="space-y-1">
                        {f.observed.length > 0 && <p><Badge tone="green">Observed</Badge> {f.observed.join("; ")}</p>}
                        {f.inferred.length > 0 && <p><Badge tone="amber">Inferred</Badge> {f.inferred.join("; ")}</p>}
                        {f.unknown.length > 0 && <p><Badge tone="slate">Unknown</Badge> {f.unknown.join("; ")}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {draft && draft.questions.length > 0 && (
        <Card title="Questions that could change the price" subtitle="Answer what you can, then update the scope. Unanswered questions lower confidence.">
          <div className="space-y-3">
            {draft.questions.map((q) => (
              <Field
                key={q.question}
                label={
                  <span className="flex flex-wrap items-center gap-2 normal-case tracking-normal">
                    <span className="text-sm font-semibold text-ink">{q.question}</span>
                    <Badge tone={q.priceImpact === "HIGH" ? "red" : q.priceImpact === "MEDIUM" ? "amber" : "slate"}>{q.priceImpact} impact</Badge>
                  </span>
                }
                hint={q.whyItMatters}
              >
                <Input value={answers[q.question] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.question]: e.target.value })} placeholder="Answer…" />
              </Field>
            ))}
            <Button variant="secondary" onClick={onRefine} disabled={refining || !Object.values(answers).some((a) => a.trim())}>
              {refining ? "Updating scope…" : "Update scope with answers"}
            </Button>
            <p className="text-xs text-muted">Your manual edits to hours, crew and prices are preserved when the scope is updated.</p>
          </div>
        </Card>
      )}

      <Card title="Tasks" subtitle="Edit anything. Changing hours or crew marks the task as your override.">
        <div className="space-y-3">
          {input.tasks.map((t, i) => (
            <TaskCard key={t.id} task={t} index={i} result={result} update={update} role={role} />
          ))}
          {!input.tasks.length && <Notice tone="warning">No tasks yet — add one from the templates below.</Notice>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={addTpl}
              onChange={(e) => setAddTpl(e.target.value)}
              options={[{ value: "", label: "Add a task from a template…" }, ...templates.map((t) => ({ value: t.key, label: `${t.categoryName} — ${t.name}` }))]}
            />
            <Button
              variant="secondary"
              disabled={!addTpl}
              onClick={() => {
                const tpl = templates.find((t) => t.key === addTpl);
                if (!tpl) return;
                update((d) => {
                  const task = taskFromTemplate(tpl, 1);
                  d.tasks.push(task);
                  for (const m of tpl.materials) {
                    const p = pmap.get(m.materialKey);
                    if (p && !d.materials.some((x) => x.materialKey === p.key)) d.materials.push(materialFromPrice(p, Math.max(1, Math.ceil(m.perJob ?? m.qtyPerUnit ?? 1)), task.id));
                  }
                  tpl.riskKeys.forEach((k) => !d.risk.factors.some((f) => f.key === k) && d.risk.factors.push({ key: k }));
                });
                setAddTpl("");
              }}
            >
              Add task
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                update((d) => {
                  d.tasks.push({
                    id: uid("task"), name: "Custom task", templateKey: null, quantity: 1, unit: "each",
                    hoursLow: 0.5, hoursTypical: 1, hoursHigh: 1.5, hoursBasis: "TYPICAL", hoursSource: "USER",
                    hoursRationale: "Entered manually by estimator.", setupHours: 0.25, cleanupHours: 0.25,
                    crew: ["LEAD"], skill: "SKILLED", tradeFlags: [], complications: [], dependsOn: [],
                  });
                })
              }
            >
              + Blank task
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Materials" subtitle="Material cost = qty × unit cost × (1 + waste). Every price shows its source and date.">
        <div className="space-y-2">
          {input.materials.map((m, i) => {
            const line = result.materials.lines[i];
            const setM = (fn: (x: typeof m) => void) => update((d) => { const x = d.materials.find((y) => y.id === m.id); if (x) fn(x); });
            return (
              <div key={m.id} className={cx("rounded-xl border p-3", line?.priceMissing ? "border-red-300 bg-red-50/40" : "border-line")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="min-w-0 flex-1" value={m.name} onChange={(e) => setM((x) => (x.name = e.target.value))} />
                  {line?.priceMissing ? (
                    <Badge tone="red">Price needed</Badge>
                  ) : m.customerSupplied ? (
                    <Badge>Customer-supplied</Badge>
                  ) : (
                    <Badge tone={m.source === "DEMO_PRICE_BOOK" ? "amber" : "blue"}>
                      {m.source === "DEMO_PRICE_BOOK" ? "Demo price book" : m.source.toLowerCase().replace("_", " ")} · {m.priceDate ?? "no date"}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Field label={`Qty (${m.unit})`}>
                    <NumberInput value={m.quantity} min={0} onChange={(n) => setM((x) => (x.quantity = n ?? 0))} />
                  </Field>
                  {perms.seeCosts && (
                    <Field label="Unit cost">
                      <NumberInput
                        prefix="$"
                        value={m.unitCost}
                        min={0}
                        placeholder="Enter"
                        onChange={(n) => setM((x) => { x.unitCost = n; x.source = n == null ? "UNPRICED" : "MANUAL"; x.priceDate = today(); })}
                      />
                    </Field>
                  )}
                  {perms.seeCosts && (
                    <Field label="Waste">
                      <NumberInput suffix="%" value={Math.round(m.wastePct * 100)} min={0} onChange={(n) => setM((x) => (x.wastePct = (n ?? 0) / 100))} />
                    </Field>
                  )}
                  {perms.seeCosts && (
                    <div className="col-span-2 flex items-end justify-between gap-2 text-sm sm:col-span-2">
                      <div className="tabular">
                        <div>Cost <strong>{fmtMoney(line?.cost ?? 0)}</strong></div>
                        <div className="text-xs text-muted">Sells at {fmtMoney(line?.sellingPrice ?? 0)} ({fmtPct(line?.markupPct ?? 0)} markup)</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <Toggle checked={m.customerSupplied} onChange={(v) => setM((x) => (x.customerSupplied = v))} label="Customer supplies this" />
                  <button type="button" className="text-sm font-semibold text-red-700" onClick={() => update((d) => { d.materials = d.materials.filter((x) => x.id !== m.id); })}>
                    Remove
                  </button>
                </div>
                {m.notes && <p className="mt-1 text-xs text-muted">{m.notes}</p>}
              </div>
            );
          })}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={addMat}
              onChange={(e) => setAddMat(e.target.value)}
              options={[{ value: "", label: "Add from price book…" }, ...priceBook.map((p) => ({ value: p.key, label: `${p.name} (${p.unit})` }))]}
            />
            <Button variant="secondary" disabled={!addMat} onClick={() => { const p = pmap.get(addMat); if (p) update((d) => { d.materials.push(materialFromPrice(p, 1)); }); setAddMat(""); }}>
              Add material
            </Button>
            <Button variant="ghost" onClick={() => update((d) => { d.materials.push(unpricedMaterial("New material", 1, "each")); })}>
              + Unlisted material
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Travel & procurement">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Site visits">
            <NumberInput value={input.travel.visits} min={0} step="1" onChange={(n) => update((d) => (d.travel.visits = n ?? 0))} />
          </Field>
          <Field label="Round-trip miles / visit">
            <NumberInput value={input.travel.roundTripMiles} min={0} onChange={(n) => update((d) => (d.travel.roundTripMiles = n ?? 0))} />
          </Field>
          <Field label="Travel hrs / visit / person">
            <NumberInput value={input.travel.travelHoursPerVisit} min={0} step="0.05" onChange={(n) => update((d) => (d.travel.travelHoursPerVisit = n ?? 0))} />
          </Field>
          <Field label="Procurement hours" hint="Buying / picking up materials">
            <NumberInput value={input.procurementHours} min={0} step="0.05" onChange={(n) => update((d) => (d.procurementHours = n ?? 0))} />
          </Field>
        </div>
        <Toggle checked={input.travel.includeTravelLabor} onChange={(v) => update((d) => (d.travel.includeTravelLabor = v))} label="Include travel time as labor cost" />
        {perms.seeCosts && (
          <p className="text-xs text-muted">
            Mileage {fmtMoney(result.direct.mileageCost)} · travel labor {fmtMoney(result.labor.travel.cost)} · procurement {fmtMoney(result.labor.procurement.cost)}
          </p>
        )}
      </Card>

      {perms.seeCosts && (
        <Card title="Other direct costs" subtitle="Equipment, disposal, permits, parking, tolls, delivery. Permit fees are never assumed — enter the real amount.">
          <div className="space-y-2">
            {input.otherCosts.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_110px_auto] items-end gap-2 sm:grid-cols-[160px_1fr_130px_auto]">
                <Select
                  className="col-span-3 sm:col-span-1"
                  value={c.type}
                  onChange={(e) => update((d) => { const x = d.otherCosts.find((y) => y.id === c.id); if (x) x.type = e.target.value as OtherCostType; })}
                  options={OTHER_COST_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ") }))}
                />
                <Input value={c.description} onChange={(e) => update((d) => { const x = d.otherCosts.find((y) => y.id === c.id); if (x) x.description = e.target.value; })} />
                <NumberInput prefix="$" value={c.amount} min={0} onChange={(n) => update((d) => { const x = d.otherCosts.find((y) => y.id === c.id); if (x) x.amount = n ?? 0; })} />
                <button type="button" className="h-11 px-2 text-sm font-semibold text-red-700" onClick={() => update((d) => { d.otherCosts = d.otherCosts.filter((x) => x.id !== c.id); })}>
                  ✕
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => update((d) => { d.otherCosts.push({ id: uid("oc"), type: "OTHER", description: "", amount: 0 }); })}>
              + Add cost
            </Button>
          </div>
        </Card>
      )}

      {perms.seeCosts && (
        <Card title="Subcontractors" subtitle="Cost is the quote you receive; customer price applies sub markup.">
          <div className="space-y-3">
            {input.subcontractors.map((s) => {
              const setS = (fn: (x: typeof s) => void) => update((d) => { const x = d.subcontractors.find((y) => y.id === s.id); if (x) fn(x); });
              const r = result.direct.subs.find((x) => x.id === s.id);
              return (
                <div key={s.id} className="space-y-2 rounded-xl border border-line p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label="Trade"><Input value={s.trade} onChange={(e) => setS((x) => (x.trade = e.target.value))} /></Field>
                    <Field label="Quoted cost"><NumberInput prefix="$" value={s.quotedCost} min={0} onChange={(n) => setS((x) => (x.quotedCost = n ?? 0))} /></Field>
                    <Field label="Customer price"><div className="tabular flex min-h-11 items-center font-semibold">{fmtMoney(r?.customerPrice ?? 0)}</div></Field>
                  </div>
                  <Input value={s.description} placeholder="What they'll do" onChange={(e) => setS((x) => (x.description = e.target.value))} />
                  <div className="flex flex-wrap gap-4">
                    <Toggle checked={s.quoteReceived} onChange={(v) => setS((x) => (x.quoteReceived = v))} label="Quote received" />
                    <Toggle checked={s.licenseRequired} onChange={(v) => setS((x) => (x.licenseRequired = v))} label="License may be required" />
                    <button type="button" className="text-sm font-semibold text-red-700" onClick={() => update((d) => { d.subcontractors = d.subcontractors.filter((x) => x.id !== s.id); })}>Remove</button>
                  </div>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" onClick={() => update((d) => { d.subcontractors.push({ id: uid("sub"), trade: "", description: "", quotedCost: 0, markupPct: null, licenseRequired: true, quoteReceived: false }); })}>
              + Add subcontractor
            </Button>
          </div>
        </Card>
      )}

      <Card title="Risk & contingency" subtitle="Contingency covers uncertainty — it's separate from profit and always shown.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={result.risk.level === "HIGH" ? "red" : result.risk.level === "MEDIUM" ? "amber" : "green"}>{result.risk.level} risk</Badge>
            <span className="text-muted">score {result.risk.score} · contingency {fmtPct(result.risk.contingencyPct)}{perms.seeCosts && ` = ${fmtMoney(result.risk.contingencyAmount)}`}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {RISK_FACTORS.map((rf) => {
              const on = selectedRisk.has(rf.key);
              const note = input.risk.factors.find((f) => f.key === rf.key)?.note;
              return (
                <button
                  type="button"
                  key={rf.key}
                  onClick={() => update((d) => { d.risk.factors = on ? d.risk.factors.filter((f) => f.key !== rf.key) : [...d.risk.factors, { key: rf.key }]; })}
                  className={cx("rounded-xl border px-3 py-2 text-left text-sm", on ? "border-amber-300 bg-amber-50" : "border-line bg-white")}
                >
                  <span className="flex items-center justify-between gap-2 font-medium">
                    {rf.label}
                    <span className={cx("text-xs", on ? "text-amber-700" : "text-muted")}>{on ? `+${rf.weight}` : "off"}</span>
                  </span>
                  {on && <span className="mt-0.5 block text-xs text-slate-600">{note || rf.explanation}</span>}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Risk level">
              <Chips
                value={input.risk.levelOverride ?? "AUTO"}
                onChange={(v) => update((d) => (d.risk.levelOverride = v === "AUTO" ? null : (v as "LOW" | "MEDIUM" | "HIGH")))}
                options={[{ value: "AUTO", label: `Auto (${result.risk.computedLevel})` }, { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }]}
              />
            </Field>
            <Field label="Contingency override" hint="Leave blank to use the configured % for the risk level">
              <NumberInput
                suffix="%"
                value={input.risk.contingencyPctOverride == null ? null : Math.round(input.risk.contingencyPctOverride * 1000) / 10}
                min={0}
                onChange={(n) => update((d) => (d.risk.contingencyPctOverride = n == null ? null : n / 100))}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="What we know" subtitle="These drive the confidence score.">
        <div className="grid gap-1 sm:grid-cols-2">
          <Toggle checked={input.confidence.siteVisited} onChange={(v) => update((d) => (d.confidence.siteVisited = v))} label="Site inspection completed" />
          <Toggle checked={input.confidence.dimensionsKnown} onChange={(v) => update((d) => (d.confidence.dimensionsKnown = v))} label="Dimensions / quantities confirmed" />
        </div>
        <Field label="Scope clarity" className="mt-2">
          <Chips
            value={input.confidence.scopeClarity}
            onChange={(v) => update((d) => (d.confidence.scopeClarity = v))}
            options={[{ value: "CLEAR", label: "Clear" }, { value: "SOMEWHAT_CLEAR", label: "Somewhat clear" }, { value: "UNCLEAR", label: "Unclear" }]}
          />
        </Field>
      </Card>

      <Card title="Assumptions & exclusions" subtitle="Shown on the customer estimate. One per line.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Assumptions">
            <TextArea rows={5} value={input.assumptions.join("\n")} onChange={(e) => update((d) => (d.assumptions = e.target.value.split("\n")))} />
          </Field>
          <Field label="Exclusions">
            <TextArea rows={5} value={input.exclusions.join("\n")} onChange={(e) => update((d) => (d.exclusions = e.target.value.split("\n")))} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
