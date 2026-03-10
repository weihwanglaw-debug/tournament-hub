import React from "react";
import { Trash2, CheckCircle } from "lucide-react";
import type { SeedEntry } from "@/types/config";

interface Props {
  seeds: SeedEntry[];
  maxSeeds: number;
  showAutoAssign: boolean;
  seedError: string | null;
  onAutoAssign: () => void;
  onUpdateSeed: (id: string, val: string) => void;
  onClearSeed: (id: string) => void;
}

export function SeedingTable({
  seeds, maxSeeds, showAutoAssign, seedError,
  onAutoAssign, onUpdateSeed, onClearSeed,
}: Props) {
  const seededCount = seeds.filter(s => s.seed !== null).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-base">Participant Seeding</h3>
          {maxSeeds > 0 && (
            <span className="text-xs px-2 py-1 font-semibold" style={{
              backgroundColor: seededCount > maxSeeds ? "var(--badge-closed-bg)" : "var(--badge-soon-bg)",
              color:           seededCount > maxSeeds ? "var(--badge-closed-text)" : "var(--badge-soon-text)",
            }}>
              {seededCount} / {maxSeeds} seeded
            </span>
          )}
        </div>
        {showAutoAssign && (
          <button onClick={onAutoAssign}
            className="btn-outline flex items-center gap-2 px-4 py-2 text-xs font-medium">
            <CheckCircle className="h-3.5 w-3.5" /> Auto-Assign from SBA
          </button>
        )}
      </div>

      {seedError && (
        <p className="text-xs font-semibold mb-3 px-3 py-2" style={{
          backgroundColor: "var(--badge-closed-bg)",
          color: "var(--badge-closed-text)",
          border: "1px solid var(--badge-closed-text)",
        }}>
          ⚠ {seedError}
        </p>
      )}

      <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="trs-table">
          <thead>
            <tr>
              <th>Club / School / Company</th>
              <th>Participants</th>
              <th style={{ width: 130 }}>Seeding</th>
            </tr>
          </thead>
          <tbody>
            {seeds.map(s => {
              const isDup = s.seed !== null && seeds.filter(x => x.seed === s.seed).length > 1;
              return (
                <tr key={s.id} style={isDup ? { backgroundColor: "var(--badge-closed-bg)" } : undefined}>
                  <td className="font-medium text-sm">{s.club}</td>
                  <td className="text-sm opacity-70">{s.participants.join(" / ")}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="1" className="field-input py-1 text-sm text-center"
                        style={isDup
                          ? { borderColor: "var(--badge-closed-text)", width: "4.5rem" }
                          : { width: "4.5rem" }}
                        value={s.seed ?? ""} placeholder="—"
                        onChange={e => onUpdateSeed(s.id, e.target.value)}
                      />
                      {s.seed !== null && (
                        <button onClick={() => onClearSeed(s.id)}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 transition-opacity hover:opacity-80"
                          style={{ color: "var(--badge-closed-text)", border: "1px solid var(--badge-closed-text)" }}
                          title="Remove seeding">
                          <Trash2 className="h-3 w-3" /> Clear
                        </button>
                      )}
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