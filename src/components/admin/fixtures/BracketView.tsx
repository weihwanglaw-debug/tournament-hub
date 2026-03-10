/**
 * BracketView.tsx — SVG-based tournament bracket renderer
 *
 * Uses precise pixel math from bracketLayout.ts — no CSS pseudo-element tricks.
 * Cards are <foreignObject> nodes placed at exact coordinates.
 * Connector <path> elements use the same coordinate system so they always align.
 */

import React from "react";
import { Trophy } from "lucide-react";
import type { BracketState, MatchEntry, TeamEntry, FixtureFormat, GroupEntry } from "@/types/config";
import { computeGroupStandings } from "@/lib/fixtureEngine";
import {
  CARD_W, CARD_H, SLOT_H, DIV_H, STUB, COL_W, HDR_H,
  LINE_COLOR, LINE_W, LINE_WIN, LINE_WIN_W,
  bodyH, cardCY, cardTY, cardLX,
  buildSpecs, type Spec,
} from "./bracketLayout";

// ─── Match card ────────────────────────────────────────────────────────────────

function Card({ match, x, y }: { match?: MatchEntry; x: number; y: number }) {
  const isDone = !!match && (match.status === "Completed" || match.status === "Walkover");
  const games  = match?.games ?? [];

  const t1wins = games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2).length;
  const t2wins = games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1).length;

  const t1Score = match?.walkover
    ? (match.walkoverWinner === "team1" ? "W/O" : "—")
    : isDone ? String(t1wins) : null;
  const t2Score = match?.walkover
    ? (match.walkoverWinner === "team2" ? "W/O" : "—")
    : isDone ? String(t2wins) : null;

  const scoreLabel = !match?.walkover && games.some(g => g.p1 !== "")
    ? games.filter(g => g.p1 !== "").map(g => `${g.p1}-${g.p2}`).join(" ")
    : null;

  const Slot = ({ team, isWinner, empty, score }: {
    team?: TeamEntry; isWinner: boolean; empty?: boolean; score?: string | null;
  }) => (
    <div style={{
      height: SLOT_H, display: "flex", alignItems: "center", gap: 5,
      padding: "0 8px", overflow: "hidden",
      background: isWinner ? "var(--color-primary)" : "transparent",
    }}>
      {!empty && team?.seed != null && (
        <span style={{
          fontSize: 9, fontWeight: 800, flexShrink: 0, minWidth: 14,
          color: isWinner ? "rgba(255,255,255,.85)" : "var(--color-primary)",
        }}>#{team.seed}</span>
      )}
      <span style={{
        fontSize: 11, fontWeight: 600, flex: 1, minWidth: 0,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        fontStyle: empty ? "italic" : "normal",
        color: empty ? "#94a3b8" : isWinner ? "#ffffff" : "#1e293b",
      }}>
        {empty ? "TBD" : (team?.label || "TBD")}
      </span>
      {score != null && (
        <span style={{
          fontSize: 11, fontWeight: 800, flexShrink: 0, minWidth: 20,
          textAlign: "center", padding: "1px 4px", borderRadius: 2,
          background: isWinner ? "rgba(0,0,0,.18)" : "#e2e8f0",
          color: isWinner ? "#ffffff" : "#1e293b",
        }}>{score}</span>
      )}
      {isWinner && isDone && (
        <Trophy style={{ width: 9, height: 9, color: "#fff", flexShrink: 0 }} />
      )}
    </div>
  );

  // Empty / TBD card
  if (!match) {
    return (
      <foreignObject x={x} y={y} width={CARD_W} height={CARD_H}>
        <div style={{
          width: CARD_W, height: CARD_H, overflow: "hidden",
          border: "1.5px dashed #cbd5e1", background: "#f8fafc", opacity: 0.55,
        }}>
          <Slot isWinner={false} empty />
          <div style={{ height: DIV_H, background: "#e2e8f0" }} />
          <Slot isWinner={false} empty />
        </div>
      </foreignObject>
    );
  }

  return (
    <foreignObject x={x} y={y} width={CARD_W} height={CARD_H}>
      <div style={{
        width: CARD_W, height: CARD_H, overflow: "hidden",
        border: "1.5px solid #94a3b8", background: "#ffffff",
        boxShadow: "0 2px 6px rgba(0,0,0,.10)",
      }}>
        <Slot team={match.team1} isWinner={match.winner === "team1"} score={t1Score} />
        <div style={{
          height: DIV_H, background: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 6px",
        }}>
          {scoreLabel && (
            <span style={{
              fontSize: 8, fontWeight: 600, color: "#64748b",
              background: "#ffffff", padding: "0 3px", borderRadius: 2,
            }}>{scoreLabel}</span>
          )}
        </div>
        <Slot team={match.team2} isWinner={match.winner === "team2"} score={t2Score} />
      </div>
    </foreignObject>
  );
}

// ─── Connector line ────────────────────────────────────────────────────────────
// Path: right-centre of card A  →  stub right  →  vertical  →  stub into card B

function Connector({ ci, aIdx, aCount, bIdx, bCount, h, hasWinner }: {
  ci: number;
  aIdx: number; aCount: number;
  bIdx: number; bCount: number;
  h: number;
  hasWinner: boolean;
}) {
  const ax = cardLX(ci) + CARD_W;
  const ay = cardCY(aIdx, aCount, h);
  const bx = cardLX(ci + 1);
  const by = cardCY(bIdx, bCount, h);
  const mx = ax + STUB;

  return (
    <path
      d={`M ${ax} ${ay} H ${mx} V ${by} H ${bx}`}
      fill="none"
      stroke={hasWinner ? LINE_WIN : LINE_COLOR}
      strokeWidth={hasWinner ? LINE_WIN_W : LINE_W}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// ─── Full SVG bracket ──────────────────────────────────────────────────────────

function BracketSVG({ specs }: { specs: Spec[] }) {
  if (specs.length === 0) return null;

  const h    = bodyH(specs[0].count);
  const svgW = specs.length * COL_W + STUB;
  const svgH = HDR_H + h;

  // Build connectors: each card in column i+1 feeds from two cards in column i
  const connectors: React.ReactNode[] = [];
  for (let ci = 0; ci < specs.length - 1; ci++) {
    const left  = specs[ci];
    const right = specs[ci + 1];
    for (let rj = 0; rj < right.count; rj++) {
      for (const [offset, label] of [[0, "top"], [1, "bot"]] as [number, string][]) {
        const aIdx = rj * 2 + offset;
        if (aIdx >= left.count) continue;
        connectors.push(
          <Connector
            key={`c-${ci}-${rj}-${label}`}
            ci={ci}
            aIdx={aIdx}  aCount={left.count}
            bIdx={rj}    bCount={right.count}
            h={h}
            hasWinner={!!left.matches[aIdx]?.winner}
          />
        );
      }
    }
  }

  const last       = specs[specs.length - 1];
  const finalMatch = last?.matches[0];
  const champion   = finalMatch?.winner
    ? (finalMatch.winner === "team1" ? finalMatch.team1 : finalMatch.team2)
    : null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "20px 16px 24px", overflowX: "auto" }}>
      <svg width={svgW} height={svgH} style={{ display: "block", overflow: "visible" }}>

        {/* Round header labels */}
        {specs.map((spec, ci) => (
          <g key={`hdr-${ci}`}>
            <text
              x={cardLX(ci) + CARD_W / 2} y={HDR_H - 10}
              textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", fill: "var(--color-primary)", letterSpacing: "0.07em", fontFamily: "inherit" }}
            >
              {spec.label}
            </text>
            <line
              x1={cardLX(ci)} y1={HDR_H - 2}
              x2={cardLX(ci) + CARD_W} y2={HDR_H - 2}
              stroke="var(--color-primary)" strokeWidth={2}
            />
          </g>
        ))}

        {/* Connectors drawn behind cards */}
        <g transform={`translate(0, ${HDR_H})`}>{connectors}</g>

        {/* Match cards */}
        <g transform={`translate(0, ${HDR_H})`}>
          {specs.map((spec, ci) => {
            const cards: (MatchEntry | undefined)[] = [
              ...spec.matches,
              ...Array(Math.max(0, spec.count - spec.matches.length)).fill(undefined),
            ];
            return cards.map((match, i) => (
              <Card key={`card-${ci}-${i}`} match={match} x={cardLX(ci)} y={cardTY(i, spec.count, h)} />
            ));
          })}
        </g>

        {/* Champion banner */}
        {champion && (() => {
          const cx = cardLX(specs.length - 1) + CARD_W + STUB + 8;
          const cy = HDR_H + h / 2;
          return (
            <g transform={`translate(${cx}, ${cy})`}>
              <text y={-16} textAnchor="middle" style={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "inherit" }}>
                Champion
              </text>
              <text y={4} textAnchor="middle" style={{ fontSize: 13, fill: "var(--color-primary)", fontWeight: 700, fontFamily: "inherit" }}>
                {champion.label.length > 12 ? champion.label.slice(0, 11) + "…" : champion.label}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Group phase mini-standings (shown above the KO bracket) ──────────────────

function GroupStrip({ groups, scoringRule }: { groups: GroupEntry[]; scoringRule: string }) {
  if (!groups.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
      {groups.map(grp => {
        const st = computeGroupStandings(grp, scoringRule as never);
        return (
          <div key={grp.id} style={{ flex: "1 1 180px", minWidth: 160, maxWidth: 280, border: "1px solid #e2e8f0", background: "#fff", overflow: "hidden" }}>
            <div style={{ background: "var(--color-primary)", color: "#fff", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", padding: "5px 10px" }}>
              {grp.name}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {["Team", "P", "W", "L", "Pts"].map(col => (
                    <th key={col} style={{ padding: "3px 8px", fontWeight: 600, fontSize: 9, textTransform: "uppercase", color: "#64748b", textAlign: col === "Team" ? "left" : "center" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {st.map((s, si) => (
                  <tr key={s.team.id} style={{ background: si % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "5px 8px", color: "#1e293b", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 16, height: 16, fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", background: s.rank <= 2 ? "var(--color-primary)" : "transparent", color: s.rank <= 2 ? "#fff" : "#94a3b8", borderRadius: 2, flexShrink: 0 }}>
                        {s.rank}
                      </span>
                      {s.team.label}
                    </td>
                    {[s.played, s.wins, s.losses, s.points].map((v, vi) => (
                      <td key={vi} style={{ padding: "5px 8px", textAlign: "center", fontWeight: vi === 1 ? 700 : vi === 3 ? 800 : 400, color: vi === 1 ? "var(--badge-open-text)" : "#1e293b" } as React.CSSProperties}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─── Public export ─────────────────────────────────────────────────────────────

export function BracketView({ bracketState }: {
  bracketState: BracketState;
  format: FixtureFormat;   // kept in props signature for caller compatibility
}) {
  const { groups, sections, matches: koMatches } = bracketState;
  const hasGroups = groups.length > 0;
  const isPureKo  = !hasGroups && !sections.length;

  const advancingCount = hasGroups
    ? groups.length * ((bracketState.config as any)?.advancePerGroup ?? 2)
    : sections.length > 0
      ? sections.length
      : koMatches.length > 0
        ? koMatches.filter(m => m.round === Math.min(...koMatches.map(x => x.round))).length * 2
        : 8;

  const specs       = buildSpecs(koMatches, advancingCount);
  const scoringRule = (bracketState as any).scoringRule ?? "badminton_21";

  const Empty = ({ msg }: { msg: string }) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
      {msg}
    </div>
  );

  if (isPureKo && koMatches.length === 0) return <Empty msg="No matches generated yet." />;

  return (
    <div>
      {hasGroups && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#64748b", marginBottom: 8 }}>
            Group Phase
          </div>
          <GroupStrip groups={groups} scoringRule={scoringRule} />
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#64748b", margin: "16px 0 8px" }}>
            Knockout Bracket
          </div>
        </>
      )}
      {specs.length > 0
        ? <BracketSVG specs={specs} />
        : <Empty msg="Complete the group phase to generate the knockout bracket." />}
    </div>
  );
}