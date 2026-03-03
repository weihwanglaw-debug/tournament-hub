import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Download, ArrowLeft } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = config.events.find((e) => e.id === id) as TournamentEvent | undefined;

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold mb-2">Event Not Found</h1>
            <button onClick={() => navigate("/")} className="btn-primary px-4 py-2 rounded-lg text-sm mt-4">
              Back to Home
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const status = getEventStatus(event);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16" style={{ backgroundColor: "var(--color-page-bg)" }}>
        {/* Hero banner */}
        <div
          className="py-12 px-6"
          style={{ background: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}
        >
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-sm mb-4 opacity-70 hover:opacity-100 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" /> Back to events
            </button>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start gap-3 mb-2">
                <h1 className="font-heading font-extrabold text-3xl md:text-4xl" style={{ color: "var(--color-hero-text)" }}>
                  {event.name}
                </h1>
                <StatusBadge status={status} />
              </div>
              <p className="opacity-80 max-w-2xl">{event.description}</p>
            </motion.div>
          </div>
        </div>

        {/* Event info */}
        <div className="max-w-5xl mx-auto py-10 px-6">
          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <div className="space-y-4">
              <InfoRow icon={Calendar} label="Event Dates" value={`${formatDate(event.eventStartDate)} – ${formatDate(event.eventEndDate)}`} />
              <InfoRow icon={MapPin} label="Venue" value={`${event.venue}, ${event.venueAddress}`} />
              <InfoRow icon={Users} label="Max Participants" value={String(event.maxParticipants)} />
              <InfoRow icon={Calendar} label="Registration Period" value={`${formatDate(event.openDate)} – ${formatDate(event.closeDate)}`} />
              {event.sponsorInfo && (
                <p className="text-sm opacity-70 italic">{event.sponsorInfo}</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {event.prospectusUrl && (
                <a
                  href={event.prospectusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm w-fit"
                >
                  <Download className="h-4 w-4" /> Download Prospectus
                </a>
              )}
              {status === "upcoming" && (
                <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
                  Registration opens on {formatDate(event.openDate)}
                </div>
              )}
              {status === "closed" && (
                <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)" }}>
                  Registration Closed
                </div>
              )}
            </div>
          </div>

          {/* Programs table */}
          <h2 className="font-heading font-bold text-xl mb-4">Programs</h2>
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}>
                  <th className="text-left px-4 py-3 font-semibold">Program</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Age</th>
                  <th className="text-left px-4 py-3 font-semibold">Gender</th>
                  <th className="text-right px-4 py-3 font-semibold">Fee</th>
                  <th className="text-center px-4 py-3 font-semibold">Players</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {event.programs.map((prog) => (
                  <tr
                    key={prog.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--color-table-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-row-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td className="px-4 py-3 font-medium">{prog.name}</td>
                    <td className="px-4 py-3">{prog.type}</td>
                    <td className="px-4 py-3">{prog.minAge}–{prog.maxAge}</td>
                    <td className="px-4 py-3">{prog.gender}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--color-primary)" }}>
                      ${prog.fee}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prog.minPlayers === prog.maxPlayers ? prog.maxPlayers : `${prog.minPlayers}–${prog.maxPlayers}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={status !== "open"}
                        onClick={() => navigate(`/event/${event.id}/register?program=${prog.id}`)}
                        className="btn-primary px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Register
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 mt-0.5 opacity-60" style={{ color: "var(--color-primary)" }} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-50">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
