"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReviewResult, ScopeDraft } from "@/lib/ai/types";
import { calculateEstimate } from "@/lib/engine/estimate";
import { fmtMoney, fmtPct } from "@/lib/engine/money";
import type { EngineSettings, EstimateInput } from "@/lib/engine/types";
import { can, type AppRole } from "@/lib/role";
import {
  emptyInput,
  inputFromTemplates,
  materialsForTasks,
  otherCostsForTemplates,
  taskFromTemplate,
  type HistoryStat,
  type PriceEntry,
  type TemplateRecord,
} from "@/lib/scope";
import { Button, cx, GuardrailBadge, Notice } from "../ui";
import { PricingStep } from "./PricingStep";
import { ScopeEditor } from "./ScopeEditor";
import {
  StepCustomer,
  StepDescribe,
  StepServiceLine,
  type CustomerForm,
  type CustomerOption,
  type DescribeState,
  type PropertyForm,
} from "./StepsIntro";

export interface WizardInitial {
  estimateId: string;
  number: string;
  customer: CustomerForm;
  property: PropertyForm;
  input: EstimateInput;
  draft: ScopeDraft | null;
  answers: Record<string, string>;
  photos: { id: string; url: string }[];
  description: string;
}

const STEPS = ["Customer", "Service", "Describe", "Scope", "Price"];

function preserveOverrides(prev: EstimateInput, next: EstimateInput): EstimateInput {
  const out = structuredClone(next);
  for (const t of out.tasks) {
    const p = prev.tasks.find((x) => x.hoursSource === "USER" && ((t.templateKey && x.templateKey === t.templateKey) || x.name === t.name));
    if (p) Object.assign(t, { hoursBasis: p.hoursBasis, customHoursPerUnit: p.customHoursPerUnit, crew: p.crew, setupHours: p.setupHours, cleanupHours: p.cleanupHours, hoursSource: "USER" });
  }
  for (const m of out.materials) {
    const p = prev.materials.find((x) => x.source === "MANUAL" && ((m.materialKey && x.materialKey === m.materialKey) || x.name === m.name));
    if (p) Object.assign(m, { unitCost: p.unitCost, source: p.source, priceDate: p.priceDate });
  }
  out.travel = prev.travel;
  out.procurementHours = prev.procurementHours;
  out.pricing = prev.pricing;
  out.confidence = { ...out.confidence, siteVisited: prev.confidence.siteVisited };
  return out;
}

export function Wizard({
  role,
  settings,
  templates,
  priceBook,
  history,
  customers,
  aiAvailable,
  initial,
}: {
  role: AppRole;
  settings: EngineSettings;
  templates: TemplateRecord[];
  priceBook: PriceEntry[];
  history: HistoryStat[];
  customers: CustomerOption[];
  aiAvailable: boolean;
  initial?: WizardInitial & { step?: number };
}) {
  const router = useRouter();
  const perms = can(role);
  const [step, setStep] = useState(initial ? (initial.step ?? 4) : 1);
  const [customer, setCustomer] = useState<CustomerForm>(initial?.customer ?? { name: "", phone: "", email: "", customerType: "HOMEOWNER", existing: false });
  const [property, setProperty] = useState<PropertyForm>(initial?.property ?? { address: "", zip: "", propertyType: "SINGLE_FAMILY", ageBand: "UNKNOWN", occupied: true });
  const [describe, setDescribe] = useState<DescribeState>({ text: initial?.description ?? "", structured: {}, photos: initial?.photos ?? [], picks: [] });
  const [draft, setDraft] = useState<ScopeDraft | null>(initial?.draft ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [input, setInput] = useState<EstimateInput>(initial?.input ?? emptyInput(settings));
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewedKey, setReviewedKey] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiRunIds, setAiRunIds] = useState<string[]>([]);

  const tmap = useMemo(() => new Map(templates.map((t) => [t.key, t])), [templates]);
  const pmap = useMemo(() => new Map(priceBook.map((p) => [p.key, p])), [priceBook]);

  const update = (fn: (d: EstimateInput) => void) =>
    setInput((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  // Inputs the estimator doesn't type directly are derived here so the engine always sees current facts.
  const effective: EstimateInput = useMemo(() => {
    const keys = new Set(input.tasks.map((t) => t.templateKey).filter(Boolean) as string[]);
    const similar = history.filter((h) => keys.has(h.templateKey)).reduce((m, h) => Math.max(m, h.completedJobs), 0);
    const openHigh = (draft?.questions ?? []).filter((q) => q.priceImpact === "HIGH" && !answers[q.question]?.trim()).length;
    return {
      ...input,
      serviceLine: "ON_DEMAND",
      title: input.title || draft?.jobTitle || "Untitled estimate",
      assumptions: input.assumptions.map((s) => s.trim()).filter(Boolean),
      exclusions: input.exclusions.map((s) => s.trim()).filter(Boolean),
      confidence: { ...input.confidence, photosCount: describe.photos.length, openQuestions: openHigh, similarCompletedJobs: similar, propertyAgeBand: property.ageBand },
    };
  }, [input, draft, answers, describe.photos.length, property.ageBand, history]);

  const result = useMemo(() => calculateEstimate(effective, settings), [effective, settings]);
  const effectiveKey = JSON.stringify(effective);

  const assemble = (d: ScopeDraft): EstimateInput => {
    const base = emptyInput(settings);
    const existingKeys = new Set(d.tasks.map((t) => t.templateKey).filter(Boolean));
    const extra = describe.picks
      .filter((p) => p.quantity > 0 && !existingKeys.has(p.key) && tmap.get(p.key))
      .map((p) => ({ template: tmap.get(p.key)!, task: taskFromTemplate(tmap.get(p.key)!, p.quantity) }));
    const extraMaterials = materialsForTasks(extra, pmap).filter((m) => !d.materials.some((x) => x.materialKey && x.materialKey === m.materialKey));
    const extraCosts = otherCostsForTemplates(extra.map((e) => e.template)).filter((c) => !d.otherCosts.some((x) => x.type === c.type));
    const riskKeys = new Set(d.riskFactors.map((r) => r.key));
    return {
      ...base,
      title: d.jobTitle,
      tasks: [...d.tasks, ...extra.map((e) => e.task)],
      materials: [...d.materials, ...extraMaterials],
      otherCosts: [...d.otherCosts, ...extraCosts],
      subcontractors: d.subcontractors,
      risk: { factors: [...d.riskFactors, ...extra.flatMap((e) => e.template.riskKeys).filter((k) => !riskKeys.has(k)).map((key) => ({ key }))], levelOverride: null, contingencyPctOverride: null },
      confidence: { ...base.confidence, scopeClarity: d.scopeClarity, dimensionsKnown: d.dimensionsKnown },
      assumptions: d.assumptions,
      exclusions: d.exclusions,
    };
  };

  const runScope = async (refine: boolean) => {
    setError("");
    const hasText = describe.text.trim() || describe.photos.length || Object.values(describe.structured).some((v) => v.trim());
    if (!hasText && !refine) {
      const picks = describe.picks.filter((p) => p.quantity > 0 && tmap.get(p.key));
      if (!picks.length) {
        setError("Describe the job, add a photo, or pick at least one template.");
        return;
      }
      const next = inputFromTemplates({ picks: picks.map((p) => ({ template: tmap.get(p.key)!, quantity: p.quantity })), priceBook: pmap, settings, property });
      next.confidence.scopeClarity = "CLEAR";
      next.confidence.dimensionsKnown = true;
      const qs = picks.flatMap((p) => tmap.get(p.key)!.questions.map((q) => ({ question: q, whyItMatters: `Affects "${tmap.get(p.key)!.name}".`, priceImpact: "MEDIUM" as const })));
      setDraft({
        engine: "rule-based", notice: "", jobTitle: next.title, summary: "Built from selected job templates.", scopeClarity: "CLEAR", needsClarification: false,
        tasks: next.tasks, materials: next.materials, otherCosts: next.otherCosts, subcontractors: [], riskFactors: next.risk.factors, photoFindings: [],
        questions: qs.slice(0, 6), assumptions: next.assumptions, exclusions: next.exclusions, dimensionsKnown: true,
        explanation: [`Built from ${picks.length} selected template(s). Labor hours are template assumptions marked "Needs validation".`],
      });
      setInput(next);
      setStep(4);
      return;
    }
    setBuilding(true);
    try {
      const res = await fetch("/api/ai/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: describe.text,
          structured: describe.structured,
          photoIds: describe.photos.map((p) => p.id),
          answers: Object.entries(answers).filter(([, a]) => a.trim()).map(([question, answer]) => ({ question, answer })),
          property,
          customerType: customer.customerType,
          estimateId: initial?.estimateId ?? null,
        }),
      });
      const d = (await res.json()) as ScopeDraft & { error?: string };
      if (!res.ok) throw new Error(d.error || "Scope builder failed");
      const next = assemble(d);
      setInput((prev) => (refine || prev.tasks.length ? preserveOverrides(prev, next) : next));
      if (refine) {
        // Keep answered questions visible with their answers.
        const answered = (draft?.questions ?? []).filter((q) => answers[q.question]?.trim());
        d.questions = [...answered, ...d.questions.filter((q) => !answered.some((a) => a.question === q.question))];
      }
      setDraft(d);
      if (d.aiRunId) setAiRunIds((x) => [...x, d.aiRunId!]);
      setStep(4);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuilding(false);
    }
  };

  const runReview = async () => {
    setReviewing(true);
    try {
      const res = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: effective, estimateId: initial?.estimateId ?? null }) });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || "Review failed");
      setReview(r);
      setReviewedKey(effectiveKey);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReviewing(false);
    }
  };

  const save = async (then: "detail" | "customer") => {
    setError("");
    if (!customer.name.trim() || !property.address.trim()) {
      setError("Customer name and property address are required.");
      setStep(1);
      return;
    }
    if (then === "customer" && result.materials.missingPriceCount > 0) {
      setError("Enter prices for all materials (or mark them customer-supplied) before generating the customer estimate.");
      return;
    }
    if (then === "customer" && result.quoted.guardrail === "LOSS" && !window.confirm("This price is below the fully loaded cost — the job is expected to lose money. Generate the customer estimate anyway?")) return;
    setSaving(true);
    const aiReasoning = {
      engine: draft?.engine,
      summary: draft?.summary,
      explanation: draft?.explanation,
      notice: draft?.notice,
      questions: draft?.questions,
      answers,
      photoFindings: draft?.photoFindings,
      description: describe.text,
      structured: describe.structured,
      review: review && reviewedKey === effectiveKey ? review : null,
    };
    try {
      const body = { customer, property, input: effective, aiReasoning, photoIds: describe.photos.map((p) => p.id), aiRunIds };
      const res = initial
        ? await fetch(`/api/estimates/${initial.estimateId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, note: "Revised estimate" }) })
        : await fetch("/api/estimates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const id = initial?.estimateId ?? data.id;
      router.push(then === "customer" ? `/estimates/${id}/customer` : `/estimates/${id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const canNext1 = customer.name.trim() && property.address.trim();
  const reviewStale = review && reviewedKey !== effectiveKey;

  return (
    <div className="pb-28">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{initial ? `Edit ${initial.number}` : "New estimate"}</h1>
          {initial && <p className="text-sm text-muted">Saving creates a new version — the original is preserved.</p>}
        </div>
      </div>

      <ol className="no-print mb-5 grid grid-cols-5 gap-1">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const reachable = n <= 3 || input.tasks.length > 0 || n <= step;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(n)}
                className={cx("w-full rounded-lg py-1.5 text-center text-xs font-semibold sm:text-sm", step === n ? "bg-brand-600 text-white" : n < step ? "bg-brand-100 text-brand-700" : "bg-white text-muted", !reachable && "opacity-50")}
              >
                <span className="hidden sm:inline">{n}. </span>
                {s}
              </button>
            </li>
          );
        })}
      </ol>

      {error && <Notice tone="critical" className="mb-4">{error}</Notice>}

      {step === 1 && <StepCustomer customers={customers} customer={customer} property={property} setCustomer={setCustomer} setProperty={setProperty} />}
      {step === 2 && <StepServiceLine value="ON_DEMAND" onChange={() => setStep(3)} />}
      {step === 3 && <StepDescribe state={describe} setState={setDescribe} templates={templates.filter((t) => t.serviceLineId !== "RECURRING")} aiAvailable={aiAvailable} />}
      {step === 4 && (
        <ScopeEditor
          input={input}
          result={result}
          update={update}
          role={role}
          draft={draft}
          answers={answers}
          setAnswers={setAnswers}
          onRefine={() => runScope(true)}
          refining={building}
          templates={templates}
          priceBook={priceBook}
          photos={describe.photos}
        />
      )}
      {step === 5 && (
        <>
          {reviewStale && <Notice tone="warning" className="mb-3">The estimate changed since the last review — re-run it before sending.</Notice>}
          <PricingStep input={effective} result={result} update={update} role={role} review={review} reviewing={reviewing} onReview={runReview} />
        </>
      )}

      {/* Sticky action bar */}
      <div className="no-print fixed inset-x-0 bottom-16 z-20 border-t border-line bg-white/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step >= 4 && perms.seePricing && input.tasks.length > 0 && (
            <div className="hidden min-w-0 flex-1 items-center gap-2 text-sm sm:flex">
              <span className="text-muted">{result.quoted.scenario === "CUSTOM" ? "Quote" : "Recommended"}</span>
              <span className="tabular text-lg font-black">{fmtMoney(result.quoted.price, { cents: false })}</span>
              <span className="tabular text-muted">{fmtPct(result.quoted.grossMarginPct)} GM</span>
              <GuardrailBadge g={result.quoted.guardrail} />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step === 1 && <Button onClick={() => setStep(2)} disabled={!canNext1}>Next: Service</Button>}
            {step === 2 && <Button onClick={() => setStep(3)}>Next: Describe job</Button>}
            {step === 3 && (
              <Button onClick={() => runScope(false)} disabled={building} size="lg">
                {building ? (aiAvailable ? "AI is building the scope…" : "Building scope…") : describe.text.trim() || describe.photos.length ? (aiAvailable ? "Build scope with AI" : "Build scope") : "Use selected templates"}
              </Button>
            )}
            {step === 4 && (
              <Button onClick={() => setStep(5)} disabled={!input.tasks.length} size="lg">
                {perms.seePricing ? "Next: Pricing" : "Next"}
              </Button>
            )}
            {step === 5 && (
              <>
                <Button variant="secondary" onClick={() => save("detail")} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                {perms.seePricing && (
                  <Button onClick={() => save("customer")} disabled={saving}>
                    Save & customer estimate
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        {step >= 4 && perms.seePricing && input.tasks.length > 0 && (
          <div className="flex items-center gap-2 border-t border-line px-4 py-1.5 text-xs sm:hidden">
            <span className="tabular text-base font-black">{fmtMoney(result.quoted.price, { cents: false })}</span>
            <span className="tabular text-muted">{fmtPct(result.quoted.grossMarginPct)} GM</span>
            <GuardrailBadge g={result.quoted.guardrail} />
          </div>
        )}
      </div>
    </div>
  );
}
