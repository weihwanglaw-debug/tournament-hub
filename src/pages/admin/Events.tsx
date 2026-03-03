import { useState } from "react";
import { useNavigate } from "react-router-dom";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import { Plus, Eye, Edit, Users } from "lucide-react";

export default function AdminEvents() {
  const navigate = useNavigate();
  const events = config.events as TournamentEvent[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-bold text-2xl">Events & Programs</h1>
        <button className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold">
          <Plus className="h-4 w-4" /> Create Event
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}>
              <th className="text-left px-4 py-3 font-semibold">Event Name</th>
              <th className="text-left px-4 py-3 font-semibold">Event Date</th>
              <th className="text-center px-4 py-3 font-semibold">Reg. Status</th>
              <th className="text-center px-4 py-3 font-semibold">Programs</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const status = getEventStatus(event);
              return (
                <tr
                  key={event.id}
                  style={{ borderBottom: "1px solid var(--color-table-border)" }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-row-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td className="px-4 py-3 font-medium">{event.name}</td>
                  <td className="px-4 py-3">
                    {formatDate(event.eventStartDate)} – {formatDate(event.eventEndDate)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 text-center">{event.programs.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/event/${event.id}`)}
                        className="p-1.5 rounded hover:bg-black/5 transition-colors"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-black/5 transition-colors" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/registrations`)}
                        className="p-1.5 rounded hover:bg-black/5 transition-colors"
                        title="Registrations"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
