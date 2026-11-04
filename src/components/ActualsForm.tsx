"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@/lib/engine/money";
import type { Role } from "@/lib/engine/types";
import { Button, Card, Chips, Field, Notice, NumberInput, TextArea } from "./ui";

const REASONS = ["As estimated", "Hidden damage found", "Scope added by customer", "Access harder than expected", "Material price changed", "Extra trip needed", "Faster than template", "Other"];

export function ActualsForm({
  estimateId,
  estimated,
  initial,
  showMoney,
}: {
  estimateId: string;
  estimated: { hoursByRole: Record<Role, number>; materials: number; subs: number; other: number; price: number };
  initial?: { hours: Record<Role, number>; materialCost: number; subCost: number; otherCost: number; finalRevenue: number; changeOrderRevenue: number; varianceReason: string; notes: string };
  showMoney: boolean;
}) {
  const router = useRouter();
  const roles = (["LEAD", "TECH", "HELPER"] as Role[]).filter((r) => estimated.hoursByRole[r] > 0 || (initial?.hours[r] ?? 0) > 0);
  const [hours, setHours] = useState<Record<Role, number>>(initial?.hours ?? { LEAD: 0, TECH: 0, HELPER: 0 });
  const [materialCost, setMaterialCost] = useState(initial?.materialCost ?? estimated.materials);
  const [subCost, setSubCost] = useState(initial?.subCost ?? estimated.subs);
  const [otherCost, setOtherCost] = useState(initial?.otherCost ?? estimated.other);
  const [finalRevenue, setFinalRevenue] = useState(initial?.finalRevenue ?? estimated.price);
  const [changeOrderRevenue, setCO] = useState(initial?.changeOrderRevenue ?? 0);
  const [reasonChip, setReasonChip] = useState(REASONS.includes(initial?.varianceReason ?? "") ? initial!.varianceReason : initial?.varianceReason ? "Other" : "As estimated");
  const [reasonText, setReasonText] = useState(REASONS.includes(initial?.varianceReason ?? "") ? "" : initial?.varianceReason ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label: Record<Role, string> = { LEAD: "Lead Tech", TECH: "Technician", HELPER: "Helper" };

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/estimates/${estimateId}/actuals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        laborHours: (Object.keys(hours) as Role[]).map((role) => ({ role, hours: hours[role] })),
        materialCost, subCost, otherCost, finalRevenue: finalRevenue + 0, changeOrderRevenue,
        varianceReason: reasonChip === "Other" ? reasonText : reasonChip,
        notes,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || "Save failed");
    router.push(`/estimates/${estimateId}`);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {error && <Notice tone="critical">{error}</Notice>}
      <Card title="Actual labor hours" subtitle="Total hours per role, including travel and material pickup.">
        <div className="grid gap-3 sm:grid-cols-3">
          {roles.map((r) => (
            <Field key={r} label={`${label[r]} (est. ${estimated.hoursByRole[r].toFixed(1)} h)`}>
              <NumberInput value={hours[r]} min={0} step="0.25" suffix="h" onChange={(n) => setHours({ ...hours, [r]: n ?? 0 })} />
            </Field>
          ))}
        </div>
      </Card>
      {showMoney && (
        <Card title="Actual costs & revenue">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={`Materials (est. ${fmtMoney(estimated.materials)})`}><NumberInput prefix="$" value={materialCost} min={0} onChange={(n) => setMaterialCost(n ?? 0)} /></Field>
            <Field label={`Subcontractors (est. ${fmtMoney(estimated.subs)})`}><NumberInput prefix="$" value={subCost} min={0} onChange={(n) => setSubCost(n ?? 0)} /></Field>
            <Field label={`Other direct (est. ${fmtMoney(estimated.other)})`} hint="Disposal, mileage, equipment, fees"><NumberInput prefix="$" value={otherCost} min={0} onChange={(n) => setOtherCost(n ?? 0)} /></Field>
            <Field label={`Final revenue (quoted ${fmtMoney(estimated.price)})`} hint="Including approved change orders"><NumberInput prefix="$" value={finalRevenue} min={0} onChange={(n) => setFinalRevenue(n ?? 0)} /></Field>
            <Field label="Of which change orders"><NumberInput prefix="$" value={changeOrderRevenue} min={0} onChange={(n) => setCO(n ?? 0)} /></Field>
          </div>
        </Card>
      )}
      <Card title="Reason for variance">
        <Chips value={reasonChip} onChange={setReasonChip} options={REASONS.map((r) => ({ value: r, label: r }))} />
        {reasonChip === "Other" && <TextArea className="mt-3" rows={2} value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="What happened?" />}
        <Field label="Notes" className="mt-3"><TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </Card>
      <Button size="lg" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save actuals & mark completed"}</Button>
    </div>
  );
}
