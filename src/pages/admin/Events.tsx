import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import { Plus, Eye, Users, MoreVertical } from "lucide-react";

export default function AdminEvents() {
  const navigate = useNavigate();
  const events = config.events as TournamentEvent[];

  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterRegStatus, setFilterRegStatus] = useState("");
  const [openAction, setOpenAction] = useState<string | null>(null);

  const filtered = useMemo(() => events.filter(ev => {
    if (filterStatus && getEventStatus(ev) !== filterStatus) return false;
    if (filterRegStatus && getEventStatus(ev) !== filterRegStatus) return false;
    if (filterDateFrom) { const to = ev.eventEndDate || ev.eventStartDate; if (to < filterDateFrom) return false; }
    if (filterDateTo) { const from = ev.eventStartDate; if (from > filterDateTo) return false; }
    return true;
  }), [events, filterStatus, filterRegStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => { setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterRegStatus(""); };
  const hasFilter = filterStatus || filterDateFrom || filterDateTo || filterRegStatus;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-bold text-2xl">Events & Programs</h1>
        <button onClick={() => navigate("/admin/events/new")}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Create Event
        </button>
      </div>

      {/* Filters */}
      <div className="p-5 mb-6" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
        <div className="grid grid-cols-2 md:flex md:flex-wrap items-end gap-4">
          <FG label="Event Status">
            <select className="field-input w-full md:w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option><option value="open">Open</option><option value="upcoming">Upcoming</option><option value="closed">Closed</option>
            </select>
          </FG>
          <FG label="Reg. Status">
            <select className="field-input w-full md:w-36" value={filterRegStatus} onChange={e => setFilterRegStatus(e.target.value)}>
              <option value="">All</option><option value="open">Open</option><option value="upcoming">Upcoming</option><option value="closed">Closed</option>
            </select>
          </FG>
          <FG label="From">
            <input type="date" className="field-input w-full md:w-40" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </FG>
          <FG label="To">
            <input type="date" className="field-input w-full md:w-40" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </FG>
          {hasFilter && (
            <button onClick={clearFilters} className="btn-outline px-4 py-2 text-xs font-medium col-span-2 md:col-span-1">Clear</button>
          )}
        </div>
        {hasFilter && <p className="text-xs mt-3 opacity-50">Showing {filtered.length} of {events.length} events</p>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="trs-table">
          <thead>
            <tr>
              <th>Event Name</th><th>Sport</th><th>Event Date</th><th>Reg. Period</th>
              <th>Reg. Status</th><th>Programs</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(event => {
              const status = getEventStatus(event);
              return (
                <tr key={event.id}>
                  <td className="font-medium">{event.name}</td>
                  <td className="text-sm opacity-70">{event.isSports ? event.sportType || "Sports" : "Non-sports"}</td>
                  <td className="text-sm">{formatDate(event.eventStartDate)} – {formatDate(event.eventEndDate)}</td>
                  <td className="text-sm opacity-70">{formatDate(event.openDate)} – {formatDate(event.closeDate)}</td>
                  <td><StatusBadge status={status} /></td>
                  <td className="text-sm">{event.programs.length}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <ActionBtn title="View / Edit" onClick={() => navigate(`/admin/events/${event.id}`)}><Eye className="h-4 w-4" /></ActionBtn>
                      <ActionBtn title="Registrations" onClick={() => navigate(`/admin/registrations?event=${event.id}`)}><Users className="h-4 w-4" /></ActionBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 opacity-40">No events match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {filtered.map(event => {
          const status = getEventStatus(event);
          return (
            <div key={event.id} className="p-5" style={{ border: "1px solid var(--color-table-border)" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{event.name}</p>
                  <p className="text-xs opacity-50 mt-0.5">{event.isSports ? event.sportType : "Non-sports"} · {event.programs.length} programs</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <StatusBadge status={status} />
                  <div className="relative">
                    <button onClick={() => setOpenAction(openAction === event.id ? null : event.id)} className="p-1.5 opacity-50 hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openAction === event.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 shadow-lg z-20 py-1"
                        style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
                        <button onClick={() => { navigate(`/admin/events/${event.id}`); setOpenAction(null); }}
                          className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:opacity-70">
                          <Eye className="h-4 w-4" /> View / Edit
                        </button>
                        <button onClick={() => { navigate(`/admin/registrations?event=${event.id}`); setOpenAction(null); }}
                          className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:opacity-70">
                          <Users className="h-4 w-4" /> Registrations
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs opacity-70">
                <div><span className="opacity-50">Event: </span>{formatDate(event.eventStartDate)} – {formatDate(event.eventEndDate)}</div>
                <div><span className="opacity-50">Reg: </span>{formatDate(event.openDate)} – {formatDate(event.closeDate)}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center py-10 opacity-40">No events match the current filters.</p>}
      </div>
    </div>
  );
}

function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="block text-xs font-semibold mb-1.5 opacity-60">{label}</label>{children}</div>);
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="p-2 transition-colors hover:opacity-70" style={{ color: "var(--color-primary)" }}>
      {children}
    </button>
  );
}
