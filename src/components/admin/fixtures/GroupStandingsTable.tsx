import React from "react";
import type { GroupEntry } from "@/types/config";
import { computeGroupStandings } from "@/lib/fixtureEngine";

interface Props {
  group: GroupEntry;
  scoringRule: string;
}

export function GroupStandingsTable({ group, scoringRule }: Props) {
  const standings = computeGroupStandings(group, scoringRule as never);
  if (standings.every(s => s.played === 0)) return null;

  return (
    <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-50 px-4 py-3 border-b"
        style={{ borderColor: "var(--color-table-border)" }}>
        {group.name} — Standings
      </p>
      <table className="trs-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th>
            <th>GF</th><th>GA</th><th>PF</th><th>PA</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map(s => (
            <tr key={s.team.id}>
              <td className="text-sm font-bold"
                style={{ color: s.rank <= 2 ? "var(--color-primary)" : undefined }}>
                {s.rank}
              </td>
              <td>
                <p className="font-medium text-sm">{s.team.label}</p>
                <p className="text-xs opacity-60">{s.team.participants.join(" / ")}</p>
              </td>
              <td className="text-sm">{s.played}</td>
              <td className="text-sm font-semibold" style={{ color: "var(--badge-open-text)" }}>{s.wins}</td>
              <td className="text-sm">{s.losses}</td>
              <td className="text-sm">{s.gamesFor}</td>
              <td className="text-sm">{s.gamesAgainst}</td>
              <td className="text-sm">{s.pointsFor}</td>
              <td className="text-sm">{s.pointsAgainst}</td>
              <td className="text-sm font-bold">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}