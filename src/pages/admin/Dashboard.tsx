import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus } from "@/lib/eventUtils";
import { CalendarDays, CalendarCheck, Activity, FileDown } from "lucide-react";

export default function Dashboard() {
  const events = config.events as TournamentEvent[];
  const openCount = events.filter((e) => getEventStatus(e) === "open").length;
  const upcomingCount = events.filter((e) => getEventStatus(e) === "upcoming").length;
  const activeCount = openCount;

  const metrics = [
    { label: "Open Registrations", value: openCount, icon: CalendarCheck, color: "var(--badge-open-text)" },
    { label: "Upcoming Events", value: upcomingCount, icon: CalendarDays, color: "var(--badge-soon-text)" },
    { label: "Active Events", value: activeCount, icon: Activity, color: "var(--color-primary)" },
  ];

  const reports = [
    "Event Summary",
    "Program Registration",
    "Participant Details",
    "Payment Summary",
    "Fixture Schedule",
  ];

  return (
    <div>
      <h1 className="font-heading font-bold text-2xl mb-6">Dashboard</h1>

      {/* Metrics */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl p-5"
            style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}
          >
            <div className="flex items-center gap-3 mb-2">
              <m.icon className="h-5 w-5" style={{ color: m.color }} />
              <span className="text-sm font-medium opacity-70">{m.label}</span>
            </div>
            <p className="font-heading font-bold text-3xl" style={{ color: m.color }}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Reports */}
      <h2 className="font-heading font-bold text-lg mb-4">Reports</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((report) => (
          <div
            key={report}
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ border: "1px solid var(--color-table-border)" }}
          >
            <span className="text-sm font-medium">{report}</span>
            <div className="flex gap-2">
              <button className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded" style={{ color: "var(--color-primary)" }}>
                <FileDown className="h-3 w-3" /> Excel
              </button>
              <button className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded" style={{ color: "var(--color-primary)" }}>
                <FileDown className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
