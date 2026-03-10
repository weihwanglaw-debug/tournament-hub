import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MatchEntry } from "@/types/config";
import { Pagination } from "@/components/ui/TableControls";
import { TeamCell } from "./shared";

interface Props {
  matches: MatchEntry[];
  page: number;
  totalPages: number;
  perPage: number;
  total: number;
  onSetPage: (n: number) => void;
  onSetPerPage: (n: number) => void;
  onOpenScore: (m: MatchEntry) => void;
  onToggleExpand: (id: string) => void;
}

function statusBadge(s: MatchEntry["status"]) {
  if (s === "Completed" || s === "Walkover") return { bg: "var(--badge-open-bg)",   text: "var(--badge-open-text)" };
  if (s === "In Progress")                   return { bg: "var(--badge-soon-bg)",   text: "var(--badge-soon-text)" };
  return                                            { bg: "var(--badge-closed-bg)", text: "var(--badge-closed-text)" };
}

export function MatchTable({
  matches, page, totalPages, perPage, total,
  onSetPage, onSetPerPage, onOpenScore, onToggleExpand,
}: Props) {
  if (matches.length === 0) {
    return <p className="text-sm opacity-40 py-8 text-center">No matches in this view yet.</p>;
  }

  return (
    <div style={{ border: "1px solid var(--color-table-border)" }}>
      <div className="overflow-x-auto">
        <table className="trs-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>Match</th>
              <th>Round</th>
              <th>Team 1</th>
              <th style={{ width: 36 }} className="text-center">vs</th>
              <th>Team 2</th>
              <th>Score</th>
              <th>Time</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(match => {
              const ss = statusBadge(match.status);
              const isDone = match.status === "Completed" || match.status === "Walkover";
              const scoreStr = match.walkover
                ? `W/O → ${match.walkoverWinner === "team1" ? match.team1.label : match.team2.label}`
                : match.games.every(g => g.p1 !== "" && g.p2 !== "")
                  ? match.games.map(g => `${g.p1}–${g.p2}`).join(", ")
                  : "—";

              return (
                <React.Fragment key={match.id}>
                  <tr>
                    <td>
                      <button onClick={() => onToggleExpand(match.id)} className="p-1 opacity-40 hover:opacity-100">
                        {match.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                    <td>
                      <div className="font-mono text-xs">{match.id}</div>
                      <div className="text-xs opacity-50">{match.roundLabel}</div>
                    </td>
                    <td className="text-sm font-medium">
                      {match.groupId ? `Grp ${match.groupId}` : match.sectionId ? `Sec ${match.sectionId}` : `R${match.round}`}
                    </td>
                    <td><TeamCell team={match.team1} isWinner={match.winner === "team1"} /></td>
                    <td className="text-center opacity-30 font-bold text-sm">vs</td>
                    <td><TeamCell team={match.team2} isWinner={match.winner === "team2"} /></td>
                    <td className="font-mono text-xs whitespace-nowrap">{scoreStr}</td>
                    <td className="text-xs opacity-70 whitespace-nowrap">
                      {match.startTime ? `${match.startTime}${match.endTime ? ` – ${match.endTime}` : ""}` : "—"}
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                        style={{ backgroundColor: ss.bg, color: ss.text }}>
                        {match.status}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => onOpenScore(match)}
                        className="btn-primary px-3 py-1.5 text-xs font-semibold whitespace-nowrap">
                        {isDone ? "Edit Score" : "Enter Score"}
                      </button>
                    </td>
                  </tr>

                  {match.expanded && (
                    <tr>
                      <td colSpan={10} className="p-0">
                        <div className="px-8 py-5 grid sm:grid-cols-3 gap-6"
                          style={{ backgroundColor: "var(--color-row-hover)", borderTop: "1px solid var(--color-table-border)" }}>

                          {/* Score breakdown */}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-3 opacity-50">Score Breakdown</p>
                            {match.walkover ? (
                              <p className="text-sm font-medium">
                                W/O → {match.walkoverWinner === "team1" ? match.team1.label : match.team2.label}
                              </p>
                            ) : match.games.some(g => g.p1 !== "") ? (
                              <div className="space-y-1">
                                <div className="grid grid-cols-[48px_1fr_16px_1fr] gap-2 text-xs opacity-50 mb-2">
                                  <span></span>
                                  <span className="truncate">{match.team1.label}</span>
                                  <span></span>
                                  <span className="truncate">{match.team2.label}</span>
                                </div>
                                {match.games.map((g, i) => {
                                  const p1w = g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2;
                                  const p2w = g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1;
                                  return (
                                    <div key={i} className="grid grid-cols-[48px_1fr_16px_1fr] gap-2 text-sm items-center">
                                      <span className="text-xs opacity-40">G{i + 1}</span>
                                      <span className="font-bold" style={{ color: p1w ? "var(--color-primary)" : undefined }}>{g.p1 || "—"}</span>
                                      <span className="opacity-20 text-center">–</span>
                                      <span className="font-bold" style={{ color: p2w ? "var(--color-primary)" : undefined }}>{g.p2 || "—"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs opacity-40">No scores yet.</p>
                            )}
                          </div>

                          {/* Participants */}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-3 opacity-50">Participants</p>
                            {[match.team1, match.team2].map((team, ti) => (
                              <div key={ti} className="mb-3">
                                <p className="text-xs font-semibold mb-1">{team.label}</p>
                                {team.participants.map((p, pi) => (
                                  <p key={pi} className="text-xs opacity-60">{pi + 1}. {p}</p>
                                ))}
                              </div>
                            ))}
                          </div>

                          {/* Officials */}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-3 opacity-50">Officials</p>
                            {match.officials.length > 0
                              ? match.officials.map(o => (
                                  <div key={o.id} className="flex gap-2 text-xs mb-1">
                                    <span className="opacity-50 w-20 flex-shrink-0">{o.role}</span>
                                    <span>{o.name}</span>
                                  </div>
                                ))
                              : <p className="text-xs opacity-40">None assigned.</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page} totalPages={totalPages} perPage={perPage} total={total}
        setPage={onSetPage} setPerPage={onSetPerPage}
      />
    </div>
  );
}