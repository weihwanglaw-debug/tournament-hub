import type { EventStatus } from "@/types/config";

const styles: Record<EventStatus, { bg: string; text: string; label: string }> = {
  open: { bg: "var(--badge-open-bg)", text: "var(--badge-open-text)", label: "Open" },
  upcoming: { bg: "var(--badge-soon-bg)", text: "var(--badge-soon-text)", label: "Upcoming" },
  closed: { bg: "var(--badge-closed-bg)", text: "var(--badge-closed-text)", label: "Closed" },
};

export default function StatusBadge({ status }: { status: EventStatus }) {
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}
