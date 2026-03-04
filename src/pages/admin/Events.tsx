import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import { Plus, Eye, Users } from "lucide-react";

export default function AdminEvents() {
  const navigate  = useNavigate();
  const events    = config.events as TournamentEvent[];

  const [filterStatus,    setFilterStatus]    = useState("");
  const [filterDateFrom,  setFilterDateFrom]  = useState("");
  const [filterDateTo,    setFilterDateTo]    = useState("");
  const [filterRegStatus, setFilterRegStatus] = useState("");

  const filtered = useMemo(() => events.filter(ev => {
    // Event status (open/upcoming/closed)
    if (filterStatus && getEventStatus(ev) !== filterStatus) return false;

    // Registration status — same as event status from reg perspective
    if (filterRegStatus && getEventStatus(ev) !== filterRegStatus) return false;

    // Date range — event overlaps with [from, to] window
    if (filterDateFrom) {
      const to = ev.eventEndDate || ev.eventStartDate;
      if (to < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const from = ev.eventStartDate;
      if (from > filterDateTo) return false;
    }

    return true;
  }), [events, filterStatus, filterRegStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterRegStatus("");
  };

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
        <div className="flex flex-wrap items-end gap-4">
          <FG label="Event Status">
            <select className="field-input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="upcoming">Upcoming</option>
              <option value="closed">Closed</option>
            </select>
          </FG>
          <FG label="Reg. Status">
            <select className="field-input w-36" value={filterRegStatus} onChange={e => setFilterRegStatus(e.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="upcoming">Upcoming</option>
              <option value="closed">Closed</option>
            </select>
          </FG>
          <FG label="Event Date From">
            <input type="date" className="field-input w-40" value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)} />
          </FG>
          <FG label="Event Date To">
            <input type="date" className="field-input w-40" value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)} />
          </FG>
          {hasFilter && (
            <button onClick={clearFilters} className="btn-outline px-4 py-2 text-xs font-medium self-end">
              Clear Filters
            </button>
          )}
        </div>
        {hasFilter && (
          <p className="text-xs mt-3 opacity-50">
            Showing {filtered.length} of {events.length} events
          </p>
        )}
      </div>

      <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="trs-table">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Sport</th>
              <th>Event Date</th>
              <th>Reg. Period</th>
              <th>Reg. Status</th>
              <th>Programs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(event => {
              const status = getEventStatus(event);
              return (
                <tr key={event.id}>
                  <td className="font-medium">{event.name}</td>
                  <td className="text-sm opacity-70">
                    {(event as any).isSports ? (event as any).sportType || "Sports" : "Non-sports"}
                  </td>
                  <td className="text-sm">
                    {formatDate(event.eventStartDate)} – {formatDate(event.eventEndDate)}
                  </td>
                  <td className="text-sm opacity-70">
                    {formatDate(event.openDate)} – {formatDate(event.closeDate)}
                  </td>
                  <td><StatusBadge status={status} /></td>
                  <td className="text-sm">{event.programs.length}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <ActionBtn title="View / Edit" onClick={() => navigate(`/admin/events/${event.id}`)}>
                        <Eye className="h-4 w-4" />
                      </ActionBtn>
                      <ActionBtn title="Registrations" onClick={() => navigate(`/admin/registrations?event=${event.id}`)}>
                        <Users className="h-4 w-4" />
                      </ActionBtn>
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
    </div>
  );
}

function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 opacity-60">{label}</label>
      {children}
    </div>
  );
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick}
      className="p-2 transition-colors hover:opacity-70"
      style={{ color: "var(--color-primary)" }}>
      {children}
    </button>
  );
}