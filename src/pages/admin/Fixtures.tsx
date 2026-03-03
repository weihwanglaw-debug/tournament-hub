import { useState } from "react";
import { GitBranch, Download, Upload } from "lucide-react";

export default function AdminFixtures() {
  const [mode, setMode] = useState<"external" | "internal">("internal");

  return (
    <div>
      <h1 className="font-heading font-bold text-2xl mb-6">Fixture Management</h1>

      {/* Mode selection */}
      <div className="flex gap-3 mb-8">
        {(["external", "internal"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{
              backgroundColor: mode === m ? "var(--color-primary)" : "transparent",
              color: mode === m ? "#fff" : "var(--color-body-text)",
              border: `1px solid ${mode === m ? "var(--color-primary)" : "var(--color-table-border)"}`,
            }}
          >
            {m === "external" ? "Mode A — External (TournamentSoftware)" : "Mode B — Internal Bracket"}
          </button>
        ))}
      </div>

      {mode === "external" ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ border: "1px solid var(--color-table-border)" }}
        >
          <Download className="h-10 w-10 mx-auto mb-4 opacity-40" />
          <h2 className="font-heading font-bold text-lg mb-2">Export for TournamentSoftware</h2>
          <p className="text-sm opacity-60 mb-4">
            Export participant list in a predefined format compatible with TournamentSoftware.
          </p>
          <button className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 mx-auto">
            <Download className="h-4 w-4" /> Export Participant List
          </button>
        </div>
      ) : (
        <div>
          <div
            className="rounded-xl p-6 mb-6"
            style={{ border: "1px solid var(--color-table-border)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <GitBranch className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
              <h2 className="font-heading font-bold text-lg">Internal Bracket Management</h2>
            </div>
            <p className="text-sm opacity-60 mb-4">
              Generate brackets, enter scores, and track match progress. Seeding must be finalized before fixture generation.
            </p>
            <div className="flex gap-3">
              <button className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">
                Generate Bracket
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--color-table-border)" }}
              >
                <Upload className="h-4 w-4 inline mr-1" /> Import Seeding
              </button>
            </div>
          </div>

          {/* Match list placeholder */}
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}>
                  <th className="text-left px-4 py-3 font-semibold">Match ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Participants</th>
                  <th className="text-center px-4 py-3 font-semibold">Score</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="text-center px-4 py-8 opacity-40">
                    No fixtures generated yet. Generate a bracket to get started.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
