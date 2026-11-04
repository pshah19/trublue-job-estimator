import type { CustomerDoc } from "@/lib/customerDoc";
import { fmtMoney } from "@/lib/engine/money";

export function CustomerEstimate({ doc }: { doc: CustomerDoc }) {
  return (
    <article className="print-sheet mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-10">
      {doc.isDemo && <div className="mb-4 rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs font-semibold text-amber-800">SAMPLE — SYNTHETIC DEMO DATA</div>}
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-lg font-black text-white" title="Branding placeholder">TB</div>
          <div>
            <div className="text-lg font-bold text-brand-900">{doc.company.name}</div>
            <div className="text-xs text-muted">{[doc.company.address, doc.company.phone, doc.company.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="text-sm sm:text-right">
          <div className="text-2xl font-black tracking-tight">ESTIMATE</div>
          <div className="font-mono">{doc.number}</div>
          <div className="text-muted">Date: {doc.date}</div>
          <div className="text-muted">Valid until: {doc.validUntil}</div>
        </div>
      </header>

      <section className="grid gap-4 py-5 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase text-muted">Prepared for</div>
          <div className="font-semibold">{doc.customer.name}</div>
          {doc.customer.phone && <div className="text-sm">{doc.customer.phone}</div>}
          {doc.customer.email && <div className="text-sm">{doc.customer.email}</div>}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted">Property</div>
          <div className="font-semibold">{doc.property.address}</div>
          <div className="text-sm">{doc.property.zip}</div>
        </div>
      </section>

      <section className="border-t border-line py-5">
        <h2 className="text-lg font-bold">{doc.title}</h2>
        <h3 className="mt-3 text-xs font-semibold uppercase text-muted">Scope of work — included</h3>
        <ol className="mt-2 space-y-2">
          {doc.scope.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-semibold text-brand-700">{i + 1}.</span>
              <span>
                <span className="font-medium">{s.name}</span> <span className="text-muted">({s.quantity})</span>
                {s.detail && <span className="block text-sm text-slate-600">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm">Includes setup, protection of work areas, cleanup and {doc.scope.length > 1 ? "coordination of all items in a single visit where possible" : "removal of job debris"}.</p>
      </section>

      {doc.materials.length > 0 && (
        <section className="border-t border-line py-5">
          <h3 className="text-xs font-semibold uppercase text-muted">Materials</h3>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {doc.materials.map((m, i) => (
              <li key={i}>
                {m.name} <span className="text-muted">— {m.quantity}{m.customerSupplied ? " (supplied by customer)" : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-line py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase text-muted">{doc.packageName ? doc.packageName : "Price"}</div>
            <div className="text-sm text-muted">{doc.duration}</div>
          </div>
          <div className="tabular text-right">
            <div className="text-sm">Subtotal {fmtMoney(doc.price)}</div>
            {doc.tax > 0 && <div className="text-sm">Tax {fmtMoney(doc.tax)}</div>}
            <div className="text-3xl font-black">{fmtMoney(doc.total)}</div>
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase text-muted">Optional upgrades</h3>
          <p className="text-sm text-muted">None included with this estimate. Ask us about bundling additional items into the same visit.</p>
        </div>
      </section>

      <section className="grid gap-5 border-t border-line py-5 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted">Assumptions</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{doc.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted">Exclusions</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{doc.exclusions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      </section>
      {doc.licensingNote && <p className="border-t border-line py-3 text-sm text-slate-600">{doc.licensingNote}</p>}

      <section className="space-y-3 border-t border-line py-5 text-sm">
        <div><h3 className="text-xs font-semibold uppercase text-muted">Payment terms</h3><p>{doc.paymentTerms}</p></div>
        <div><h3 className="text-xs font-semibold uppercase text-muted">Warranty</h3><p>{doc.warranty}</p></div>
        <p className="text-muted">Any additional work discovered during the job will be presented as a written change order for your approval before it proceeds.</p>
      </section>

      <section className="grid gap-8 border-t border-line pt-6 sm:grid-cols-2">
        <div>
          <div className="h-10 border-b border-slate-400" />
          <div className="mt-1 text-xs text-muted">Customer signature — I accept this estimate</div>
        </div>
        <div>
          <div className="h-10 border-b border-slate-400" />
          <div className="mt-1 text-xs text-muted">Date</div>
        </div>
      </section>
    </article>
  );
}
