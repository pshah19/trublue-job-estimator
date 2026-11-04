"use client";
import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { Guardrail } from "@/lib/engine/types";

import { cx } from "@/lib/cx";
export { cx };

export function Card({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-white shadow-sm", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-200",
  secondary: "bg-white text-ink border border-line hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};

export function Button({ variant = "primary", className, size = "md", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed",
        size === "sm" ? "min-h-9 px-3 text-sm" : size === "lg" ? "min-h-14 px-6 text-base" : "min-h-11 px-4 text-sm",
        variants[variant],
        className,
      )}
    />
  );
}

export function LinkButton({ href, variant = "primary", className, children, size = "md" }: { href: string; variant?: Variant; className?: string; children: ReactNode; size?: "sm" | "md" | "lg" }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        size === "sm" ? "min-h-9 px-3 text-sm" : size === "lg" ? "min-h-14 px-6 text-base" : "min-h-11 px-4 text-sm",
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full min-h-11 rounded-xl border border-line bg-white px-3 text-base text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}

export function TextArea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, "py-2", p.className)} />;
}

export function Select({ options, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...p} className={cx(inputCls, "pr-8", p.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Numeric input that keeps the user's text while typing and reports numbers. */
export function NumberInput({ value, onChange, step = "any", min, className, suffix, prefix, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null; onChange: (n: number | null) => void; suffix?: string; prefix?: string }) {
  return (
    <div className={cx("relative", className)}>
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">{prefix}</span>}
      <input
        {...p}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={cx(inputCls, "tabular", prefix && "pl-7", suffix && "pr-12")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
    </div>
  );
}

export function Chips<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cx("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-10 rounded-full border px-3.5 text-sm font-medium transition",
            value === o.value ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink hover:border-brand-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 rounded-xl px-1 py-2 text-left">
      <span className={cx("mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition", checked ? "bg-brand-600" : "bg-slate-300")}>
        <span className={cx("h-5 w-5 rounded-full bg-white shadow transition", checked && "translate-x-5")} />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}

const badgeTones = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-brand-100 text-brand-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-800",
  violet: "bg-violet-100 text-violet-800",
} as const;

export function Badge({ children, tone = "slate", className }: { children: ReactNode; tone?: keyof typeof badgeTones; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", badgeTones[tone], className)}>{children}</span>;
}

export const GUARDRAIL_META: Record<Guardrail, { label: string; short: string; cls: string; dot: string }> = {
  LOSS: { label: "LOSS RISK — below fully loaded cost", short: "Loss risk", cls: "bg-red-50 border-red-300 text-red-800", dot: "bg-red-500" },
  MARGIN_WARNING: { label: "MARGIN WARNING — below minimum margin", short: "Below minimum", cls: "bg-orange-50 border-orange-300 text-orange-800", dot: "bg-orange-500" },
  ACCEPTABLE: { label: "ACCEPTABLE — above minimum, below target", short: "Below target", cls: "bg-amber-50 border-amber-200 text-amber-800", dot: "bg-amber-400" },
  TARGET: { label: "TARGET — meets target margin", short: "On target", cls: "bg-emerald-50 border-emerald-300 text-emerald-800", dot: "bg-emerald-500" },
  PREMIUM: { label: "PREMIUM — above premium margin", short: "Premium", cls: "bg-brand-50 border-brand-200 text-brand-700", dot: "bg-brand-500" },
};

export function GuardrailBadge({ g, long }: { g: Guardrail; long?: boolean }) {
  const m = GUARDRAIL_META[g];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold", m.cls)}>
      <span className={cx("h-2 w-2 rounded-full", m.dot)} />
      {long ? m.label : m.short}
    </span>
  );
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl bg-slate-50 px-3 py-2.5", className)}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="tabular text-lg font-bold text-ink">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Row({ label, value, strong, muted, indent }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; indent?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3 py-1", strong && "font-semibold", muted && "text-muted", indent && "pl-4 text-sm")}>
      <span>{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "critical" | "success"; children: ReactNode; className?: string }) {
  const t = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    critical: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];
  return <div className={cx("rounded-xl border px-3 py-2.5 text-sm", t, className)}>{children}</div>;
}

export function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; tone: keyof typeof badgeTones }> = {
    TEMPLATE_ASSUMPTION: { label: "Template assumption · needs validation", tone: "amber" },
    AI_ASSUMPTION: { label: "AI assumption · validate", tone: "violet" },
    HISTORY: { label: "Franchise history", tone: "green" },
    USER: { label: "Your override", tone: "blue" },
  };
  const m = map[source] ?? { label: source, tone: "slate" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
