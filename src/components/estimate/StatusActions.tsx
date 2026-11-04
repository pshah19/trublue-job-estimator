"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui";

export function StatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const set = async (s: string) => {
    setBusy(true);
    await fetch(`/api/estimates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    setBusy(false);
    router.refresh();
  };
  const del = async () => {
    if (!window.confirm("Delete this estimate and all its versions? This cannot be undone.")) return;
    setBusy(true);
    await fetch(`/api/estimates/${id}`, { method: "DELETE" });
    router.push("/estimates");
    router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => set("SENT")}>Mark sent</Button>}
      {(status === "DRAFT" || status === "SENT") && (
        <>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => set("WON")}>Mark won</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => set("LOST")}>Mark lost</Button>
        </>
      )}
      {(status === "WON" || status === "LOST") && <Button size="sm" variant="ghost" disabled={busy} onClick={() => set("SENT")}>Reopen</Button>}
      <Button size="sm" variant="danger" disabled={busy} onClick={del}>Delete</Button>
    </div>
  );
}
