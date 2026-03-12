/**
 * fixtureStatus.ts
 * Computes per-program and per-event fixture status from localStorage.
 * Pending results = scheduled date ≤ today AND no result.
 */

import type { TournamentEvent, BracketState } from "@/types/config";
import { getAllMatches } from "@/lib/fixtureEngine";
import { getEventStatus } from "@/lib/eventUtils";

const KEY = (eid: string, pid: string) => `fixture_${eid}_${pid}`;

function loadBracket(eid: string, pid: string): BracketState | null {
  try { const r = localStorage.getItem(KEY(eid, pid)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Per-program status ────────────────────────────────────────────────────────

export type ProgramFixtureStatus =
  | "reg_open"      // registration still open
  | "ready"         // reg closed, no fixture yet
  | "draft"         // fixture generated, no scores yet
  | "in_progress"   // some past-due matches with no result
  | "complete"      // all matches done
  | "not_required"; // fixtureMode = not_required

export interface ProgramFixtureInfo {
  programId:    string;
  programName:  string;
  status:       ProgramFixtureStatus;
  totalMatches: number;
  doneMatches:  number;
  pendingPastDue: number; // matches scheduled ≤ today with no result
  bracket:      BracketState | null;
}

export function getProgramFixtureInfo(
  eventId:   string,
  program:   { id: string; name: string; status?: string },
  closeDate: string,
  fixtureMode?: string,
): ProgramFixtureInfo {
  if (fixtureMode === "not_required") {
    return { programId: program.id, programName: program.name, status: "not_required", totalMatches: 0, doneMatches: 0, pendingPastDue: 0, bracket: null };
  }

  const regClosed = new Date() > new Date(closeDate);
  const bracket   = loadBracket(eventId, program.id);

  if (!regClosed) {
    return { programId: program.id, programName: program.name, status: "reg_open", totalMatches: 0, doneMatches: 0, pendingPastDue: 0, bracket: null };
  }
  if (!bracket) {
    return { programId: program.id, programName: program.name, status: "ready", totalMatches: 0, doneMatches: 0, pendingPastDue: 0, bracket: null };
  }

  // Heats format
  if (bracket.format === "heats") {
    const rounds     = bracket.heatRounds ?? [];
    const complete   = rounds.every(r => r.isComplete);
    const anyStarted = rounds.some(r => r.isComplete);
    return {
      programId: program.id, programName: program.name,
      status: complete ? "complete" : anyStarted ? "in_progress" : "draft",
      totalMatches: rounds.length, doneMatches: rounds.filter(r => r.isComplete).length,
      pendingPastDue: 0, bracket,
    };
  }

  const today   = todayStr();
  const matches = getAllMatches(bracket);
  const total   = matches.length;
  const done    = matches.filter(m => m.status === "Completed" || m.status === "Walkover").length;
  const pastDue = matches.filter(m =>
    m.matchDate && m.matchDate <= today &&
    m.status !== "Completed" && m.status !== "Walkover"
  ).length;

  if (total === 0 || done === 0) {
    return { programId: program.id, programName: program.name, status: "draft", totalMatches: total, doneMatches: 0, pendingPastDue: pastDue, bracket };
  }
  if (done === total) {
    return { programId: program.id, programName: program.name, status: "complete", totalMatches: total, doneMatches: done, pendingPastDue: 0, bracket };
  }
  return { programId: program.id, programName: program.name, status: "in_progress", totalMatches: total, doneMatches: done, pendingPastDue: pastDue, bracket };
}

// ── Per-event rollup ──────────────────────────────────────────────────────────

export type EventFixtureStatus = "reg_open" | "ready" | "in_progress" | "complete" | "not_required";

export interface EventFixtureSummary {
  eventId:        string;
  status:         EventFixtureStatus;
  readyCount:     number;
  pendingCount:   number;
  pastDueCount:   number;
  completeCount:  number;
  totalPrograms:  number;
  programs:       ProgramFixtureInfo[];
}

export function getEventFixtureSummary(event: TournamentEvent): EventFixtureSummary {
  const programs = event.programs.map(p =>
    getProgramFixtureInfo(event.id, p, event.closeDate, event.fixtureMode)
  );

  const readyCount    = programs.filter(p => p.status === "ready").length;
  const pendingCount  = programs.filter(p => p.status === "in_progress" || p.status === "draft").length;
  const pastDueCount  = programs.reduce((n, p) => n + p.pendingPastDue, 0);
  const completeCount = programs.filter(p => p.status === "complete" || p.status === "not_required").length;

  let status: EventFixtureStatus;
  if (event.fixtureMode === "not_required")             status = "not_required";
  else if (readyCount > 0)                              status = "ready";
  else if (pendingCount > 0)                            status = "in_progress";
  else if (completeCount === programs.length)           status = "complete";
  else                                                  status = "reg_open";

  return { eventId: event.id, status, readyCount, pendingCount, pastDueCount, completeCount, totalPrograms: programs.length, programs };
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export interface FixtureDashboardStats {
  pendingPayments:   number;
  pendingFixture:    number; // internal, reg closed, no fixture
  pendingResults:    number; // past-due matches with no result
}

export function getFixtureDashboardStats(events: TournamentEvent[]): FixtureDashboardStats {
  let pendingFixture  = 0;
  let pendingResults  = 0;

  for (const ev of events) {
    if (!ev.isSports) continue;
    if (ev.fixtureMode === "not_required" || ev.fixtureMode === "external") continue;
    for (const p of ev.programs) {
      const info = getProgramFixtureInfo(ev.id, p, ev.closeDate, ev.fixtureMode);
      if (info.status === "ready")                      pendingFixture++;
      if (info.status === "in_progress" || info.status === "draft") pendingResults += info.pendingPastDue;
    }
  }

  return { pendingPayments: 0, pendingFixture, pendingResults };
}