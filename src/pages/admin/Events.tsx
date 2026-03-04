import { useNavigate } from "react-router-dom";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import { Plus, Eye, Users } from "lucide-react";

export default function AdminEvents() {
  const navigate = useNavigate();
  const events = config.events as TournamentEvent[];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading font-bold text-2xl">Events & Programs</h1>
        <button
          onClick={() => navigate("/admin/events/new")}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Create Event
        </button>
      </div>

      <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="trs-table">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Event Date</th>
              <th className="text-center">Reg. Status</th>
              <th className="text-center">Programs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const status = getEventStatus(event);
              return (
                <tr key={event.id}>
                  <td className="font-medium">{event.name}</td>
                  <td>
                    {formatDate(event.eventStartDate)} – {formatDate(event.eventEndDate)}
                  </td>
                  <td className="text-center">
                    <StatusBadge status={status} />
                  </td>
                  <td className="text-center">{event.programs.length}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/admin/events/${event.id}`)}
                        className="p-2 hover:bg-black/5 transition-colors"
                        title="View / Edit"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/registrations?event=${event.id}`)}
                        className="p-2 hover:bg-black/5 transition-colors"
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
