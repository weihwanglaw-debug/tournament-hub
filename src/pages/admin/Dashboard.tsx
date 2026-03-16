/**
 * Dashboard.tsx
 *
 * Mock:  reads events from apiGetEvents() (in-memory), stats from apiGetRegistrationStats()
 * Real:  swap api function bodies — no changes needed here
 *
 * Fixture stats still read localStorage via fixtureStatus.ts.
 * When fixtureApi migrates to real backend, replace getFixtureDashboardStats()
 * with an API call here — that is the only change needed.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { TournamentEvent } from "@/types/config";
import type { RegistrationStats } from "@/lib/api";
import { apiGetEvents, apiGetRegistrationStats, apiExportRegistrations } from "@/lib/api";
import { exportRegistrationsCsv } from "@/lib/exportCsv";
import { getFixtureDashboardStats } from "@/lib/fixtureStatus";
import { CalendarCheck, CalendarDays, CreditCard, Zap, ClipboardList, FileDown } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  const [events,  setEvents]  = useState<TournamentEvent[]>([]);
  const [stats,   setStats]   = useState<RegistrationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGetEvents(), apiGetRegistrationStats()])
      .then(([evR, stR]) => {
        if (evR.data) setEvents(evR.data);
        if (stR.data) setStats(stR.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const openCount     = events.filter(e => e.openDate <= today && today <= e.closeDate).length;
  const upcomingCount = events.filter(e => e.openDate > today).length;

  // Fixture stats read from localStorage via fixtureStatus.ts
  const fx = useMemo(() => getFixtureDashboardStats(events), [events]);

  const pendingPayments = stats?.pendingPayments ?? 0;

  const metrics = [
    {
      label:  "Open Events",
      value:  openCount,
      icon:   CalendarCheck,
      color:  "var(--badge-open-text)",
      bg:     "var(--badge-open-bg)",
      border: openCount > 0 ? "var(--badge-open-text)" : "var(--color-table-border)",
      sub:    "Accepting registrations",
      action: null,
    },
    {
      label:  "Upcoming Events",
      value:  upcomingCount,
      icon:   CalendarDays,
      color:  "var(--badge-soon-text)",
      bg:     "var(--badge-soon-bg)",
      border: upcomingCount > 0 ? "var(--badge-soon-text)" : "var(--color-table-border)",
      sub:    "Registration not yet open",
      action: null,
    },
    {
      label:  "Pending Payments",
      value:  pendingPayments,
      icon:   CreditCard,
      color:  "var(--badge-closed-text)",
      bg:     pendingPayments > 0 ? "var(--badge-closed-bg)" : "var(--color-row-hover)",
      border: pendingPayments > 0 ? "var(--badge-closed-text)" : "var(--color-table-border)",
      sub:    "Awaiting payment confirmation",
      action: "/admin/registrations",
    },
    {
      label:  "Pending Fixture Setup",
      value:  fx.pendingFixture,
      icon:   Zap,
      color:  "var(--badge-closed-text)",
      bg:     fx.pendingFixture > 0 ? "var(--badge-closed-bg)" : "var(--color-row-hover)",
      border: fx.pendingFixture > 0 ? "var(--badge-closed-text)" : "var(--color-table-border)",
      sub:    "Reg. closed — no fixture generated",
      action: "/admin/fixtures",
    },
    {
      label:  "Pending Result Input",
      value:  fx.pendingResults,
      icon:   ClipboardList,
      color:  "var(--badge-soon-text)",
      bg:     fx.pendingResults > 0 ? "var(--badge-soon-bg)" : "var(--color-row-hover)",
      border: fx.pendingResults > 0 ? "var(--badge-soon-text)" : "var(--color-table-border)",
      sub:    "Scheduled matches past due",
      action: "/admin/fixtures",
    },
  ];

  // Export all registrations as CSV
  const handleExport = async () => {
    const r = await apiExportRegistrations("all");
    if (!r.data) return;
    exportRegistrationsCsv("All Events", "", r.data);
  };

  const reports = [
    "Event Summary",
    "Program Registration",
    "Participant Details",
    "Payment Summary",
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20 opacity-40 text-sm">Loading dashboard…</div>;
  }

  return (
    <div>
      <div className="admin-page-title"><h1>Dashboard</h1></div>

      {/* Metrics */}
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {metrics.map(m => {
          const inner = (
            <div className="p-5 h-full"
              style={{ border: `2px solid ${m.border}`, backgroundColor: m.bg }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 flex-shrink-0" style={{ backgroundColor: m.color }}>
                  <m.icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium opacity-70 leading-tight pt-1">{m.label}</p>
                {m.action && m.value > 0 && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 flex-shrink-0"
                    style={{ backgroundColor: m.color, color: "white" }}>
                    ACTION
                  </span>
                )}
              </div>
              <p className="font-heading font-bold text-3xl mb-1" style={{ color: m.color }}>{m.value}</p>
              <p className="text-xs opacity-50">{m.sub}</p>
            </div>
          );
          return m.action ? (
            <button key={m.label} onClick={() => navigate(m.action!)}
              className="text-left transition-opacity hover:opacity-80">
              {inner}
            </button>
          ) : (
            <div key={m.label}>{inner}</div>
          );
        })}
      </div>

      {/* Reports */}
      <h2 className="font-heading font-bold text-lg mb-4">Reports</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {reports.map(report => (
          <div key={report} className="p-5 flex items-center justify-between"
            style={{ border: "1px solid var(--color-table-border)" }}>
            <span className="text-sm font-medium">{report}</span>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5"
              style={{ color: "var(--color-primary)" }}>
              <FileDown className="h-3 w-3" /> Export CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
