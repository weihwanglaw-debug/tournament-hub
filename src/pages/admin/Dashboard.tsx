import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus } from "@/lib/eventUtils";
import { CalendarDays, CalendarCheck, Activity, FileDown, Users } from "lucide-react";

// Registration stats sourced from config.json mockStats
// Update these numbers in config.json as sample data changes
const mockStats = (config as unknown as { mockStats: Record<string, number> }).mockStats ?? {
  totalRegistrations: 0, confirmed: 0, pending: 0, cancelled: 0,
};

export default function Dashboard() {
  const events        = config.events as TournamentEvent[];
  const openCount     = events.filter((e) => getEventStatus(e) === "open").length;
  const upcomingCount = events.filter((e) => getEventStatus(e) === "upcoming").length;
  const totalPrograms = events.reduce((s, e) => s + e.programs.length, 0);

  const metrics = [
    { label: "Open Events",          value: openCount,                        icon: CalendarCheck, color: "var(--badge-open-text)"  },
    { label: "Upcoming Events",      value: upcomingCount,                    icon: CalendarDays,  color: "var(--badge-soon-text)"  },
    { label: "Total Programs",       value: totalPrograms,                    icon: Activity,      color: "var(--color-primary)"    },
    { label: "Total Registrations",  value: mockStats.totalRegistrations,     icon: Users,         color: "var(--color-primary)"    },
    { label: "Confirmed",            value: mockStats.confirmed,              icon: Users,         color: "var(--badge-open-text)"  },
  ];

  const reports = [
    "Event Summary",
    "Program Registration",
    "Participant Details",
    "Payment Summary",
    "Fixture Schedule",
  ];

  const handleDownload = (report: string, format: string) => {
    // Mock: in production this triggers GET /api/reports/:type?format=xlsx|csv
    alert(`[MOCK] Download "${report}" as ${format}\nIn production this will call GET /api/reports.`);
  };

  return (
    <div>
      <div className="admin-page-title"><h1>Dashboard</h1></div>

      {/* Metrics */}
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-5 mb-12">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="p-6"
            style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <m.icon className="h-5 w-5" style={{ color: m.color }} />
              <span className="text-xs font-medium opacity-70">{m.label}</span>
            </div>
            <p className="font-heading font-bold text-3xl" style={{ color: m.color }}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Reports */}
      <h2 className="font-heading font-bold text-lg mb-5">Reports</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div
            key={report}
            className="p-5 flex items-center justify-between"
            style={{ border: "1px solid var(--color-table-border)" }}
          >
            <span className="text-sm font-medium">{report}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(report, "Excel")}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5"
                style={{ color: "var(--color-primary)" }}
              >
                <FileDown className="h-3 w-3" /> Excel
              </button>
              <button
                onClick={() => handleDownload(report, "CSV")}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5"
                style={{ color: "var(--color-primary)" }}
              >
                <FileDown className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs mt-6 opacity-40">
        Registration counts are sourced from config.json → mockStats. Update those numbers when sample data changes.
      </p>
    </div>
  );
}
