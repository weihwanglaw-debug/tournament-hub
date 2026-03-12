/**
 * BracketView.tsx — SVG-based tournament bracket renderer
 *
 * Fixes applied:
 *  - Player name display rule: if total participants across both slots ≤ PLAYER_NAME_THRESHOLD
 *    show individual names; otherwise show club/org label only.
 *  - Click-to-score: clicking any match card opens the ScoreModal (onOpenScore prop).
 *  - Seed badge only shown when team.seed is actually set (not undefined/null).
 *  - Court / date shown on cards when available.
 *  - Card height auto-expands when player names are shown.
 */

import React from "react";
import { Trophy, MousePointerClick } from "lucide-react";
import type { BracketState, MatchEntry, TeamEntry, FixtureFormat, GroupEntry } from "@/types/config";
import { computeGroupStandings } from "@/lib/fixtureEngine";
import {
  CARD_W, SLOT_H, DIV_H, STUB, COL_W, HDR_H,
  LINE_COLOR, LINE_W, LINE_WIN, LINE_WIN_W,
  bodyH, cardCY, cardTY, cardLX,
  buildSpecs, type Spec,
} from "./bracketLayout";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * If the combined participant count for both teams in a match is ≤ this number,
 * individual player names are shown. Above it, only the club/org label shows.
 * Rule: singles (1+1=2) and doubles (2+2=4) always show names. Teams don't.
 */
const PLAYER_NAME_THRESHOLD = 4;

/** Extra height per player name line rendered below the slot label */
const NAME_LINE_H = 13;

// ── Card height calculator ─────────────────────────────────────────────────────

function cardHeight(match?: MatchEntry): number {
  if (!match) return SLOT_H * 2 + DIV_H;
  const showNames = showPlayerNames(match);
  if (!showNames) return SLOT_H * 2 + DIV_H;
  const t1extra = match.team1.participants.length * NAME_LINE_H;
  const t2extra = match.team2.participants.length * NAME_LINE_H;
  return SLOT_H * 2 + DIV_H + Math.max(t1extra, t2extra);
}

function showPlayerNames(match: MatchEntry): boolean {
  const total = match.team1.participants.length + match.team2.participants.length;
  return total <= PLAYER_NAME_THRESHOLD;
}

// ── Match card ─────────────────────────────────────────────────────────────────

function Card({
  match, x, y, onClick,
}: {
  match?: MatchEntry;
  x: number;
  y: number;
  onClick?: () => void;
}) {
  const isDone = !!match && (match.status === "Completed" || match.status === "Walkover");
  const games  = match?.games ?? [];
  const ch     = cardHeight(match);

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

  const showNames = match ? showPlayerNames(match) : false;

  const Slot = ({
    team, isWinner, empty, score,
  }: {
    team?: TeamEntry; isWinner: boolean; empty?: boolean; score?: string | null;
  }) => (
    <div style={{
      minHeight: SLOT_H,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "0 8px",
      overflow: "hidden",
      background: isWinner ? "var(--color-primary)" : "transparent",
    }}>
      {/* Club label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {/* Seed badge — only when seed is actually set (not undefined/null) */}
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
      {/* Player names — shown when within threshold */}
      {!empty && showNames && team?.participants.map((p, i) => (
        <div key={i} style={{
          fontSize: 9, color: isWinner ? "rgba(255,255,255,.75)" : "#64748b",
          paddingLeft: team.seed != null ? 19 : 0,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: `${NAME_LINE_H}px`,
        }}>
          {p}
        </div>
      ))}
    </div>
  );

  // Empty / TBD card
  if (!match) {
    return (
      <foreignObject x={x} y={y} width={CARD_W} height={ch}>
        <div style={{
          width: CARD_W, height: ch, overflow: "hidden",
          border: "1.5px dashed #cbd5e1", background: "#f8fafc", opacity: 0.55,
        }}>
          <Slot isWinner={false} empty />
          <div style={{ height: DIV_H, background: "#e2e8f0" }} />
          <Slot isWinner={false} empty />
        </div>
      </foreignObject>
    );
  }

  // Scheduled info line (court + date/time)
  const scheduleLabel = [
    match.courtNo,
    match.matchDate ? new Date(match.matchDate).toLocaleDateString("en-SG", { day: "2-digit", month: "short" }) : "",
    match.startTime,
  ].filter(Boolean).join(" · ");

  return (
    <foreignObject x={x} y={y} width={CARD_W} height={ch}>
      <div
        onClick={onClick}
        style={{
          width: CARD_W, height: ch, overflow: "hidden",
          border: "1.5px solid #94a3b8", background: "#ffffff",
          boxShadow: "0 2px 6px rgba(0,0,0,.10)",
          cursor: onClick ? "pointer" : "default",
          transition: "box-shadow .15s",
        }}
        title={onClick ? "Click to enter / edit score" : undefined}
      >
        <Slot team={match.team1} isWinner={match.winner === "team1"} score={t1Score} />
        <div style={{
          height: DIV_H, background: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px",
        }}>
          {scheduleLabel ? (
            <span style={{ fontSize: 7.5, fontWeight: 600, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
              {scheduleLabel}
            </span>
          ) : <span />}
          {scoreLabel && (
            <span style={{
              fontSize: 8, fontWeight: 600, color: "#64748b",
              background: "#ffffff", padding: "0 3px", borderRadius: 2, flexShrink: 0,
            }}>{scoreLabel}</span>
          )}
          {!isDone && onClick && !scoreLabel && (
            <MousePointerClick style={{ width: 9, height: 9, color: "#94a3b8", flexShrink: 0 }} />
          )}
        </div>
        <Slot team={match.team2} isWinner={match.winner === "team2"} score={t2Score} />
      </div>
    </foreignObject>
  );
}

// ── Connector line ─────────────────────────────────────────────────────────────

function Connector({
  ci, aIdx, aCount, bIdx, bCount, h, hasWinner, matchA, matchB,
}: {
  ci: number;
  aIdx: number; aCount: number;
  bIdx: number; bCount: number;
  h: number;
  hasWinner: boolean;
  matchA?: MatchEntry;
  matchB?: MatchEntry;
}) {
  // Use actual card height for centre-Y calculation
  const chA = cardHeight(matchA);
  const chB = cardHeight(matchB);

  // Recalculate centres using real card heights
  // cardCY assumes uniform CARD_H — we override with real heights
  const aY = cardTY(aIdx, aCount, h) + chA / 2;
  const bY = cardTY(bIdx, bCount, h) + chB / 2;

  const ax = cardLX(ci) + CARD_W;
  const bx = cardLX(ci + 1);
  const mx = ax + STUB;

  return (
    <path
      d={`M ${ax} ${aY} H ${mx} V ${bY} H ${bx}`}
      fill="none"
      stroke={hasWinner ? LINE_WIN : LINE_COLOR}
      strokeWidth={hasWinner ? LINE_WIN_W : LINE_W}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// ── Full SVG bracket ───────────────────────────────────────────────────────────

const BracketSVG = React.forwardRef<HTMLDivElement, {
  specs: Spec[];
  onOpenScore?: (m: MatchEntry) => void;
}>(function BracketSVG({ specs, onOpenScore }, ref) {
  if (specs.length === 0) return null;

  const h    = bodyH(specs[0].count);
  const svgW = specs.length * COL_W + STUB;
  const svgH = HDR_H + h;

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
            matchA={left.matches[aIdx]}
            matchB={right.matches[rj]}
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
    <div ref={ref} style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "20px 16px 24px", overflowX: "auto" }}>
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
              <Card
                key={`card-${ci}-${i}`}
                match={match}
                x={cardLX(ci)}
                y={cardTY(i, spec.count, h)}
                onClick={match && onOpenScore ? () => onOpenScore(match) : undefined}
              />
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

      {/* Legend */}
      <div style={{ marginTop: 12, fontSize: 10, color: "#94a3b8", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>Click any match card to enter or edit the score.</span>
        {specs.some(s => s.matches.some(m => m.courtNo || m.matchDate)) && (
          <span>Cards show: court · date · start time in the divider strip.</span>
        )}
      </div>
    </div>
  );
});


// ── Public export ──────────────────────────────────────────────────────────────

/**
 * BracketView renders ONLY the knockout SVG bracket.
 * Group standings are handled by DrawTab separately.
 */
export const BracketView = React.forwardRef<HTMLDivElement, {
  bracketState: BracketState;
  format?: FixtureFormat;
  onOpenScore?: (m: MatchEntry) => void;
}>(function BracketView({ bracketState, onOpenScore }, ref) {
  const koMatches = bracketState.matches;

  const advancingCount = bracketState.groups.length > 0
    ? bracketState.groups.length * (bracketState.config?.advancePerGroup ?? 2)
    : koMatches.length > 0
      ? koMatches.filter(m => m.round === Math.min(...koMatches.map(x => x.round))).length * 2
      : 8;

  const specs = buildSpecs(koMatches, advancingCount);

  if (koMatches.length === 0) return (
    <div ref={ref} style={{ background: "#fff", border: "1px solid #e2e8f0", padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
      {bracketState.phase === "group"
        ? "Complete the group phase to generate the knockout bracket."
        : "No bracket generated yet."}
    </div>
  );

  return <BracketSVG ref={ref} specs={specs} onOpenScore={onOpenScore} />;
});