import { Badge } from "./ui";

const TONE = { DRAFT: "slate", SENT: "blue", WON: "green", LOST: "red", COMPLETED: "violet" } as const;

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status as keyof typeof TONE] ?? "slate"}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}
