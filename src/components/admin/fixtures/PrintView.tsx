import React from "react";
import type { BracketState } from "@/types/config";

interface Props {
  eventName: string;
  programName: string;
  bracketState: BracketState;
}

export function PrintView({ eventName, programName, bracketState }: Props) {
  const allMatches = [
    ...bracketState.groups.flatMap(g => g.matches),
    ...bracketState.sections.flatMap(s => s.matches),
    ...bracketState.matches,
  ];

  return (
    <div className="hidden print:block print:mt-0">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">{eventName}</h1>
        <h2 className="text-lg">{programName} — Fixture Schedule</h2>
        <p className="text-sm opacity-60">Printed: {new Date().toLocaleString("en-SG")}</p>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ backgroundColor: "#1E3A5F", color: "white" }}>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Match</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Round</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Team 1</th>
            <th style={{ padding: "6px 8px", textAlign: "center" }}>Score</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Team 2</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Time</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {allMatches.map((match, i) => {
            const scoreStr = match.walkover
              ? "W/O"
              : match.games.every(g => g.p1 !== "" && g.p2 !== "")
                ? match.games.map(g => `${g.p1}–${g.p2}`).join(", ")
                : "—";
            return (
              <tr key={match.id} style={{ backgroundColor: i % 2 === 0 ? "white" : "#F3F4F6" }}>
                <td style={{ padding: "5px 8px", fontFamily: "monospace" }}>{match.id}</td>
                <td style={{ padding: "5px 8px" }}>{match.roundLabel}</td>
                <td style={{ padding: "5px 8px", fontWeight: match.winner === "team1" ? "bold" : undefined }}>
                  {match.team1.label}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace" }}>{scoreStr}</td>
                <td style={{ padding: "5px 8px", fontWeight: match.winner === "team2" ? "bold" : undefined }}>
                  {match.team2.label}
                </td>
                <td style={{ padding: "5px 8px" }}>
                  {match.startTime ? `${match.startTime}${match.endTime ? ` – ${match.endTime}` : ""}` : "—"}
                </td>
                <td style={{ padding: "5px 8px" }}>{match.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}