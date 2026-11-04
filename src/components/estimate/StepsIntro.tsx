"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TemplateRecord } from "@/lib/scope";
import { Badge, Card, Chips, cx, Field, Input, Notice, NumberInput, Select, TextArea } from "../ui";

export interface PropertyForm {
  id?: string | null;
  address: string;
  zip: string;
  propertyType: string;
  ageBand: string;
  occupied: boolean;
}
export interface CustomerForm {
  id?: string | null;
  name: string;
  phone: string;
  email: string;
  customerType: string;
  existing: boolean;
}
export interface CustomerOption extends CustomerForm {
  id: string;
  properties: (PropertyForm & { id: string })[];
}

export const PROPERTY_TYPES = [
  { value: "SINGLE_FAMILY", label: "Single-family" },
  { value: "CONDO", label: "Condo" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "OTHER", label: "Other" },
];
export const CUSTOMER_TYPES = [
  { value: "HOMEOWNER", label: "Homeowner" },
  { value: "SENIOR", label: "Senior" },
  { value: "CAREGIVER", label: "Adult child / caregiver" },
  { value: "REALTOR", label: "Realtor" },
  { value: "PROPERTY_MANAGER", label: "Property manager" },
  { value: "COMMERCIAL", label: "Commercial customer" },
  { value: "HOME_ALLY", label: "Existing Home Ally customer" },
];
export const AGE_BANDS = [
  { value: "LT10", label: "<10 yrs" },
  { value: "10_25", label: "10–25" },
  { value: "25_50", label: "25–50" },
  { value: "50_PLUS", label: "50+" },
  { value: "UNKNOWN", label: "Unknown" },
];

// ---------------------------------------------------------------- Step 1

export function StepCustomer({
  customers,
  customer,
  property,
  setCustomer,
  setProperty,
}: {
  customers: CustomerOption[];
  customer: CustomerForm;
  property: PropertyForm;
  setCustomer: (c: CustomerForm) => void;
  setProperty: (p: PropertyForm) => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(
    () => (q.trim().length < 1 ? [] : customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6)),
    [q, customers],
  );
  return (
    <div className="space-y-4">
      <Card title="Customer" subtitle="Pick an existing customer or enter a new one.">
        <div className="space-y-3">
          <Field label="Find existing customer">
            <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          {matches.length > 0 && (
            <div className="divide-y divide-line rounded-xl border border-line">
              {matches.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
                  onClick={() => {
                    setCustomer({ id: c.id, name: c.name, phone: c.phone, email: c.email, customerType: c.customerType, existing: true });
                    if (c.properties[0]) setProperty({ ...c.properties[0] });
                    setQ("");
                  }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted">{c.properties[0]?.address}</span>
                </button>
              ))}
            </div>
          )}
          {customer.id && (
            <Notice tone="info" className="flex items-center justify-between">
              <span>Using existing customer record.</span>
              <button type="button" className="font-semibold underline" onClick={() => { setCustomer({ ...customer, id: null, existing: false }); setProperty({ ...property, id: null }); }}>
                New customer instead
              </button>
            </Notice>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer name *">
              <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="e.g. Pat Smith" autoComplete="off" />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Customer type">
            <Chips value={customer.customerType} onChange={(v) => setCustomer({ ...customer, customerType: v })} options={CUSTOMER_TYPES} />
          </Field>
          <Field label="Existing customer?">
            <Chips value={customer.existing ? "Y" : "N"} onChange={(v) => setCustomer({ ...customer, existing: v === "Y" })} options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No" }]} />
          </Field>
        </div>
      </Card>
      <Card title="Property">
        <div className="space-y-3">
          {customer.id && (customers.find((c) => c.id === customer.id)?.properties.length ?? 0) > 1 && (
            <Field label="Customer properties">
              <Select
                value={property.id ?? ""}
                onChange={(e) => {
                  const p = customers.find((c) => c.id === customer.id)?.properties.find((x) => x.id === e.target.value);
                  if (p) setProperty({ ...p });
                }}
                options={customers.find((c) => c.id === customer.id)!.properties.map((p) => ({ value: p.id, label: p.address }))}
              />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Property address *">
              <Input value={property.address} onChange={(e) => setProperty({ ...property, address: e.target.value })} placeholder="Street address" />
            </Field>
            <Field label="ZIP">
              <Input inputMode="numeric" value={property.zip} onChange={(e) => setProperty({ ...property, zip: e.target.value })} />
            </Field>
          </div>
          <Field label="Property type">
            <Chips value={property.propertyType} onChange={(v) => setProperty({ ...property, propertyType: v })} options={PROPERTY_TYPES} />
          </Field>
          <Field label="Property age">
            <Chips value={property.ageBand} onChange={(v) => setProperty({ ...property, ageBand: v })} options={AGE_BANDS} />
          </Field>
          <Field label="Occupied?">
            <Chips value={property.occupied ? "Y" : "N"} onChange={(v) => setProperty({ ...property, occupied: v === "Y" })} options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No (vacant)" }]} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Step 2

const LINES = [
  { id: "ON_DEMAND", title: "On-Demand Services", body: "Handyman, repairs, decks, doors, fencing, property services.", enabled: true },
  { id: "SENIOR", title: "Senior Services", body: "Safety assessments, aging-in-place modifications, accessibility and fall-prevention work.", enabled: false },
  { id: "RECURRING", title: "Recurring Services", body: "Home Ally maintenance and recurring home-service plans.", enabled: false },
] as const;

export function StepServiceLine({ value, onChange }: { value: string; onChange: (v: "ON_DEMAND") => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {LINES.map((l) => (
        <button
          key={l.id}
          type="button"
          disabled={!l.enabled}
          onClick={() => l.enabled && onChange("ON_DEMAND")}
          className={cx(
            "rounded-2xl border-2 bg-white p-5 text-left transition",
            value === l.id ? "border-brand-600 ring-4 ring-brand-100" : "border-line",
            l.enabled ? "hover:border-brand-500" : "cursor-not-allowed opacity-60",
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{l.title}</h3>
            {!l.enabled && <Badge>Phase 2</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted">{l.body}</p>
          {!l.enabled && <p className="mt-3 text-xs text-muted">Specialized workflow coming soon. Individual templates (e.g. grab bars) can be added to an On-Demand estimate today.</p>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Step 3

export interface DescribeState {
  text: string;
  structured: Record<string, string>;
  photos: { id: string; url: string }[];
  picks: { key: string; quantity: number }[];
}

const STRUCTURED_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "What needs to be done", label: "What needs to be done?", placeholder: "Replace boards, repaint…" },
  { key: "Where is the work", label: "Where is the work?", placeholder: "Back yard, north fence line" },
  { key: "How many items", label: "How many items?", placeholder: "6 boards" },
  { key: "Approximate dimensions", label: "Approximate dimensions?", placeholder: "16 ft section, 6 ft tall" },
  { key: "Existing condition", label: "Existing condition?", placeholder: "Boards cracked, posts solid" },
  { key: "Accessibility", label: "Accessibility?", placeholder: "Gate access, no stairs" },
  { key: "Special requirements", label: "Special requirements?", placeholder: "Match existing stain color" },
];

async function resizeImage(file: File, max = 1568): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

type SpeechRec = { start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };

function useDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
      if (t) onText(t.trim());
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };
  return { listening, supported, toggle };
}

export function StepDescribe({
  state,
  setState,
  templates,
  aiAvailable,
}: {
  state: DescribeState;
  setState: (s: DescribeState) => void;
  templates: TemplateRecord[];
  aiAvailable: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [tq, setTq] = useState("");
  const [cat, setCat] = useState("ALL");
  const stateRef = useRef(state);
  stateRef.current = state;
  const dictation = useDictation((t) => {
    const s = stateRef.current;
    setState({ ...s, text: s.text ? `${s.text.trimEnd()} ${t}` : t });
  });

  const cats = useMemo(() => {
    const seen = new Map<string, string>();
    templates.forEach((t) => seen.set(t.categoryId, t.categoryName));
    return [{ value: "ALL", label: "All" }, ...[...seen.entries()].map(([value, label]) => ({ value, label }))];
  }, [templates]);
  const filtered = useMemo(() => {
    const q = tq.toLowerCase();
    return templates
      .filter((t) => (cat === "ALL" || t.categoryId === cat) && (!q || t.name.toLowerCase().includes(q) || t.keywords.some((k) => k.includes(q))))
      .slice(0, 30);
  }, [templates, tq, cat]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files).slice(0, 10)) {
        const blob = await resizeImage(f);
        fd.append("photos", new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: blob.type || f.type }));
      }
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setState({ ...stateRef.current, photos: [...stateRef.current.photos, ...data.photos] });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addPick = (key: string) => {
    const existing = state.picks.find((p) => p.key === key);
    setState({ ...state, picks: existing ? state.picks.map((p) => (p.key === key ? { ...p, quantity: p.quantity + 1 } : p)) : [...state.picks, { key, quantity: 1 }] });
  };
  const tmap = new Map(templates.map((t) => [t.key, t]));

  return (
    <div className="space-y-4">
      <Card
        title="Describe the job"
        subtitle={aiAvailable ? "Plain English is fine. AI will break it into tasks — you'll review everything." : "Plain English is fine. Rule-based matching will map it to job templates (AI not configured)."}
      >
        <div className="space-y-3">
          <div className="relative">
            <TextArea
              rows={5}
              value={state.text}
              onChange={(e) => setState({ ...state, text: e.target.value })}
              placeholder={`e.g. "Customer wants two grab bars installed in a tiled shower and one handrail installed next to three exterior steps."`}
            />
            {dictation.supported && (
              <button
                type="button"
                onClick={dictation.toggle}
                className={cx("absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full shadow", dictation.listening ? "animate-pulse bg-red-600 text-white" : "bg-brand-600 text-white")}
                title={dictation.listening ? "Stop dictation" : "Dictate notes"}
                aria-label="Dictate"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-3.1A7 7 0 0019 11h-2z" /></svg>
              </button>
            )}
          </div>
          {dictation.listening && <p className="text-xs font-medium text-red-700">Listening… speak your job-site notes. Tap the mic to stop.</p>}
          <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setShowForm(!showForm)}>
            {showForm ? "− Hide structured details" : "+ Add structured details (optional)"}
          </button>
          {showForm && (
            <div className="grid gap-3 sm:grid-cols-2">
              {STRUCTURED_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input value={state.structured[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setState({ ...state, structured: { ...state.structured, [f.key]: e.target.value } })} />
                </Field>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Job-site photos" subtitle={aiAvailable ? "AI separates what it can see from what it infers and what it can't know." : "Photos are saved with the estimate. AI photo analysis needs an API key."}>
        <div className="flex flex-wrap gap-3">
          {state.photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="Job photo" className="h-24 w-24 rounded-xl border border-line object-cover" />
              <button type="button" className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white text-sm font-bold shadow" onClick={() => setState({ ...state, photos: state.photos.filter((x) => x.id !== p.id) })} aria-label="Remove photo">
                ×
              </button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-200 text-xs font-semibold text-brand-700 hover:bg-brand-50">
            <span className="text-2xl leading-none">+</span>
            {uploading ? "Uploading…" : "Add photos"}
            <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
        {uploadError && <Notice tone="critical" className="mt-3">{uploadError}</Notice>}
      </Card>

      <Card title="Or pick job templates" subtitle="Fastest path for standard jobs. Template hours are starting assumptions.">
        <div className="space-y-3">
          {state.picks.length > 0 && (
            <div className="space-y-2">
              {state.picks.map((p) => {
                const t = tmap.get(p.key);
                if (!t) return null;
                return (
                  <div key={p.key} className="flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-2">
                    <span className="flex-1 text-sm font-medium">{t.name}</span>
                    <NumberInput className="w-28" value={p.quantity} min={0} suffix={t.unit.length < 8 ? t.unit : ""} onChange={(n) => setState({ ...state, picks: state.picks.map((x) => (x.key === p.key ? { ...x, quantity: n ?? 0 } : x)) })} />
                    <button type="button" className="text-sm font-semibold text-red-700" onClick={() => setState({ ...state, picks: state.picks.filter((x) => x.key !== p.key) })}>
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <Input placeholder="Search templates (e.g. door, grab bar, drywall)…" value={tq} onChange={(e) => setTq(e.target.value)} />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {cats.map((c) => (
              <button key={c.value} type="button" onClick={() => setCat(c.value)} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", cat === c.value ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white")}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
            {filtered.map((t) => (
              <button key={t.key} type="button" onClick={() => addPick(t.key)} className="flex items-start justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left hover:border-brand-500">
                <span>
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {t.categoryName} · {t.typicalHoursPerUnit} h/{t.unit}
                    {t.needsValidation && " · needs validation"}
                  </span>
                </span>
                <span className="text-lg font-bold text-brand-600">+</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
