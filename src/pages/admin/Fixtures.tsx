import { useState } from "react";
import { GitBranch, Download, Upload, Play, Clock, User } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { getEventStatus } from "@/lib/eventUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Match {
  id: string;
  participants: string;
  score: string;
  startTime: string;
  endTime: string;
  referee: string;
  status: "Scheduled" | "In Progress" | "Completed";
}

const sampleMatches: Match[] = [
  { id: "M001", participants: "John Tan vs Michael Ng", score: "—", startTime: "", endTime: "", referee: "", status: "Scheduled" },
  { id: "M002", participants: "Sarah Lee vs Rachel Tan", score: "—", startTime: "", endTime: "", referee: "", status: "Scheduled" },
];

export default function AdminFixtures() {
  const [mode, setMode] = useState<"external" | "internal">("internal");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [scoreModal, setScoreModal] = useState<Match | null>(null);
  const [scoreForm, setScoreForm] = useState({ score: "", startTime: "", endTime: "", referee: "" });

  const events = config.events as TournamentEvent[];
  // Only show programs from closed events that meet min registration
  const closedEvents = events.filter((e) => getEventStatus(e) === "closed");

  const handleScoreSave = () => {
    // In real app, save score and auto-progress
    setScoreModal(null);
    setScoreForm({ score: "", startTime: "", endTime: "", referee: "" });
  };

  return (
    <div>
      <h1 className="font-heading font-bold text-2xl mb-8">Fixture Management</h1>

      {/* Event/Program selection */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label className="block text-xs font-semibold mb-2 opacity-70">Event</label>
          <select className="field-input w-64" value={selectedEvent} onChange={(e) => { setSelectedEvent(e.target.value); setSelectedProgram(""); }}>
            <option value="">Select event...</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
        {selectedEvent && (
          <div>
            <label className="block text-xs font-semibold mb-2 opacity-70">Program</label>
            <select className="field-input w-52" value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)}>
              <option value="">Select program...</option>
              {events.find((e) => e.id === selectedEvent)?.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Mode selection */}
      <div className="flex gap-0 mb-8">
        {(["external", "internal"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: mode === m ? "var(--color-primary)" : "transparent",
              color: mode === m ? "var(--color-hero-text)" : "var(--color-body-text)",
              border: `1px solid ${mode === m ? "var(--color-primary)" : "var(--color-table-border)"}`,
            }}
          >
            {m === "external" ? "Mode A — External (TournamentSoftware)" : "Mode B — Internal Bracket"}
          </button>
        ))}
      </div>

      {mode === "external" ? (
        <div className="p-10 text-center" style={{ border: "1px solid var(--color-table-border)" }}>
          <Download className="h-10 w-10 mx-auto mb-5 opacity-40" />
          <h2 className="font-heading font-bold text-lg mb-3">External Fixture Management</h2>
          <p className="text-sm opacity-60 mb-3 max-w-md mx-auto">
            Import SBA player ranking file to auto-assign seeding, then export participant list for TournamentSoftware.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button className="btn-outline flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
              <Upload className="h-4 w-4" /> Import Rankings
            </button>
            <button className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Download className="h-4 w-4" /> Export Participant List
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="p-8 mb-8" style={{ border: "1px solid var(--color-table-border)" }}>
            <div className="flex items-center gap-3 mb-5">
              <GitBranch className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
              <h2 className="font-heading font-bold text-lg">Internal Bracket Management</h2>
            </div>
            <p className="text-sm opacity-60 mb-5">
              Generate brackets, enter scores, and track match progress. Seeding must be finalized before fixture generation.
              Supports Knockout and Round Robin + Group Stage + Knockout formats.
            </p>
            <div className="flex gap-3">
              <button className="btn-primary px-5 py-2.5 text-sm font-semibold">
                Generate Bracket
              </button>
              <button className="btn-outline flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
                <Upload className="h-4 w-4" /> Import Seeding
              </button>
            </div>
          </div>

          {/* Match list */}
          <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Match ID</th>
                  <th>Participants</th>
                  <th className="text-center">Score</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Referee</th>
                  <th className="text-center">Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sampleMatches.length > 0 ? (
                  sampleMatches.map((match) => (
                    <tr key={match.id}>
                      <td className="font-mono text-xs">{match.id}</td>
                      <td className="font-medium">{match.participants}</td>
                      <td className="text-center">{match.score}</td>
                      <td className="text-sm">{match.startTime || "—"}</td>
                      <td className="text-sm">{match.endTime || "—"}</td>
                      <td className="text-sm">{match.referee || "—"}</td>
                      <td className="text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: match.status === "Completed" ? "var(--badge-open-bg)" : match.status === "In Progress" ? "var(--badge-soon-bg)" : "var(--badge-closed-bg)",
                            color: match.status === "Completed" ? "var(--badge-open-text)" : match.status === "In Progress" ? "var(--badge-soon-text)" : "var(--badge-closed-text)",
                          }}
                        >
                          {match.status}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setScoreModal(match);
                            setScoreForm({ score: match.score === "—" ? "" : match.score, startTime: match.startTime, endTime: match.endTime, referee: match.referee });
                          }}
                          className="btn-primary px-3 py-1.5 text-xs font-semibold"
                        >
                          Enter Score
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-10 opacity-40">
                      No fixtures generated yet. Generate a bracket to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Score Entry Modal */}
      <Dialog open={!!scoreModal} onOpenChange={(v) => { if (!v) { setScoreModal(null); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-heading font-bold text-xl">Score Entry</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-5">
            {scoreModal && (
              <p className="text-sm font-medium">{scoreModal.participants}</p>
            )}
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Result / Score</label>
              <input className="field-input" value={scoreForm.score} onChange={(e) => setScoreForm((p) => ({ ...p, score: e.target.value }))} placeholder="e.g. 21-15, 21-18" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Match Start Time</label>
                <input type="time" className="field-input" value={scoreForm.startTime} onChange={(e) => setScoreForm((p) => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Match End Time</label>
                <input type="time" className="field-input" value={scoreForm.endTime} onChange={(e) => setScoreForm((p) => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Referee</label>
              <input className="field-input" value={scoreForm.referee} onChange={(e) => setScoreForm((p) => ({ ...p, referee: e.target.value }))} placeholder="Referee name" />
            </div>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setScoreModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">
              Cancel
            </button>
            <button onClick={handleScoreSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">
              Save Score
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
