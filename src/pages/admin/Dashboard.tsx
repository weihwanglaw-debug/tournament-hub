/**
 * Dashboard.tsx — Admin overview.
 *
 * Registration stats come from apiGetRegistrationStats() — the stub is in
 * registrationsApi.ts. In mock mode it computes from MOCK_REGISTRATIONS.
 * In real mode it calls GET /api/registrations/stats.
 * No config.json / mockStats needed here.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiGetRegistrationStats, apiGetEvents } from "@/lib/api";
import type { RegistrationStats } from "@/lib/api";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus } from "@/lib/eventUtils";
import { getFixtureDashboardStats } from "@/lib/fixtureStatus";
import { CalendarCheck, CalendarDays, CreditCard, Zap, ClipboardList, FileDown, RefreshCw } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats,   setStats]   = useState<RegistrationStats | null>(null);
  const [events,  setEvents]  = useState<TournamentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGetRegistrationStats(),
      apiGetEvents(),
    ]).then(([statsRes, eventsRes]) => {
      if (statsRes.data)  setStats(statsRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      setLoading(false);
    });
  }, []);

  const openCount     = events.filter(e => getEventStatus(e) === "open").length;
  const upcomingCount = events.filter(e => getEventStatus(e) === "upcoming").length;
  const fx            = useMemo(() => getFixtureDashboardStats(events), [events]);
  const pendingPay    = stats?.pendingPayments ?? 0;

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
      value:  pendingPay,
      icon:   CreditCard,
      color:  "var(--badge-closed-text)",
      bg:     pendingPay > 0 ? "var(--badge-closed-bg)" : "var(--color-row-hover)",
      border: pendingPay > 0 ? "var(--badge-closed-text)" : "var(--color-table-border)",
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

  const reports = ["Event Summary", "Program Registration", "Participant Details", "Payment Summary", "Fixture Schedule"];

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
              {loading ? (
                <div className="flex items-center gap-2 h-9">
                  <RefreshCw className="h-4 w-4 animate-spin opacity-30" />
                </div>
              ) : (
                <p className="font-heading font-bold text-3xl mb-1" style={{ color: m.color }}>{m.value}</p>
              )}
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(report => (
          <div key={report} className="p-5 flex items-center justify-between"
            style={{ border: "1px solid var(--color-table-border)" }}>
            <span className="text-sm font-medium">{report}</span>
            <div className="flex gap-2">
              {["Excel", "CSV"].map(fmt => (
                <button key={fmt}
                  onClick={() => alert(`[MOCK] Download "${report}" as ${fmt}`)}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5"
                  style={{ color: "var(--color-primary)" }}>
                  <FileDown className="h-3 w-3" /> {fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {stats && (
        <p className="text-xs mt-6 opacity-35">
          {stats.totalRegistrations} total registrations · {stats.confirmed} confirmed · {stats.pending} pending.
          Fixture counts are live from generated fixtures. Pending results = scheduled date ≤ today with no result entered.
        </p>
      )}
    </div>
  );
}