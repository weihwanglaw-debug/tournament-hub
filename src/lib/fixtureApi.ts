/**
 * fixtureApi.ts — Mock API with localStorage persistence.
 * Swap for real API calls by replacing the function bodies.
 */

import type { SeedEntry, BracketState, MatchEntry, FixtureFormatConfig } from "@/types/config";
import {
  generateDraw, generateNextKnockoutRound,
  generateKnockoutFromGroups, swapTeams,
  advanceHeatsRound, saveHeatResult, assignHeatPlaces,
} from "@/lib/fixtureEngine";

const KEY = (eid: string, pid: string) => `fixture_${eid}_${pid}`;
const delay = () => new Promise(r => setTimeout(r, 60));

// ── Result types ──────────────────────────────────────────────────────────────

export interface ApiError { code: string; message: string }
export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

function ok<T>(data: T): ApiResult<T>           { return { data, error: null }; }
function err(code: string, msg: string): ApiResult<never> { return { data: null, error: { code, message: msg } }; }

function save(eid: string, pid: string, state: BracketState) {
  localStorage.setItem(KEY(eid, pid), JSON.stringify(state));
}
function load(eid: string, pid: string): BracketState | null {
  try { const r = localStorage.getItem(KEY(eid, pid)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function remove(eid: string, pid: string) { localStorage.removeItem(KEY(eid, pid)); }

// ── API functions ─────────────────────────────────────────────────────────────

/** GET /fixtures/:eventId/:programId */
export async function apiGetFixture(eventId: string, programId: string): Promise<ApiResult<BracketState | null>> {
  await delay();
  return ok(load(eventId, programId));
}

/**
 * POST /fixtures/generate
 * If prebuiltBracket provided (from wizard preview after swaps), saves it directly.
 */
export async function apiGenerateDraw(
  eventId: string, programId: string,
  seeds: SeedEntry[], config: FixtureFormatConfig,
  prebuiltBracket?: BracketState,
): Promise<ApiResult<BracketState>> {
  await delay();
  if (seeds.length < 2) return err("NOT_ENOUGH", "At least 2 participants required.");
  const seedNums = seeds.map(s => s.seed).filter((s): s is number => s !== null);
  if (seedNums.length !== new Set(seedNums).size) return err("DUPLICATE_SEEDS", "Duplicate seed numbers — each must be unique.");
  const state = prebuiltBracket ?? generateDraw(seeds, config);
  save(eventId, programId, state);
  return ok(state);
}

/** DELETE /fixtures/:eventId/:programId */
export async function apiResetFixture(eventId: string, programId: string): Promise<ApiResult<null>> {
  await delay();
  remove(eventId, programId);
  return ok(null);
}

/** PATCH /fixtures/:eventId/:programId/score/:matchId */
export async function apiSaveScore(
  eventId: string, programId: string, matchId: string,
  updates: Partial<Pick<MatchEntry, "games" | "winner" | "walkover" | "walkoverWinner" | "officials">>
): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");

  function patchMatches(matches: MatchEntry[]): MatchEntry[] {
    return matches.map(m => m.id !== matchId ? m : {
      ...m, ...updates,
      status: "Completed" as const,
      locked: true,
    });
  }
  const next: BracketState = {
    ...state, locked: true,
    matches: patchMatches(state.matches),
    groups:  state.groups.map(g => ({ ...g, matches: patchMatches(g.matches) })),
  };
  save(eventId, programId, next);
  return ok(next);
}

/** PATCH /fixtures/:eventId/:programId/schedule/:matchId — never locks */
export async function apiUpdateSchedule(
  eventId: string, programId: string, matchId: string,
  s: { courtNo: string; matchDate: string; startTime: string; endTime: string }
): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");

  function patch(matches: MatchEntry[]): MatchEntry[] {
    return matches.map(m => m.id !== matchId ? m : { ...m, ...s });
  }
  const next: BracketState = {
    ...state,
    matches: patch(state.matches),
    groups:  state.groups.map(g => ({ ...g, matches: patch(g.matches) })),
  };
  save(eventId, programId, next);
  return ok(next);
}

/** POST /fixtures/:eventId/:programId/advance-knockout */
export async function apiAdvanceToKnockout(eventId: string, programId: string): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");
  if (state.phase !== "group") return err("WRONG_PHASE", "Already in knockout phase.");
  const koMatches = generateKnockoutFromGroups(state.groups, state.config);
  const next: BracketState = { ...state, phase: "knockout", matches: koMatches };
  save(eventId, programId, next);
  return ok(next);
}

/** POST /fixtures/:eventId/:programId/next-round */
export async function apiAdvanceKnockoutRound(eventId: string, programId: string): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");
  const newRound = generateNextKnockoutRound(state.matches);
  const next: BracketState = { ...state, matches: [...state.matches, ...newRound] };
  save(eventId, programId, next);
  return ok(next);
}

/** POST /fixtures/:eventId/:programId/swap */
export async function apiSwapTeams(
  eventId: string, programId: string, idA: string, idB: string
): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");
  if (state.locked) return err("LOCKED", "Cannot swap after results have been entered.");
  const next = swapTeams(state, idA, idB);
  save(eventId, programId, next);
  return ok(next);
}

// ── Heats API ─────────────────────────────────────────────────────────────────

/** PATCH heats result */
export async function apiSaveHeatResult(
  eventId: string, programId: string,
  roundNumber: number, teamId: string, result: string
): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");
  const next = saveHeatResult(state, roundNumber, teamId, result);
  save(eventId, programId, next);
  return ok(next);
}

/** POST heats advance round */
export async function apiAdvanceHeatsRound(
  eventId: string, programId: string,
  fromRound: number, advancingIds: string[]
): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");
  const next = advanceHeatsRound(state, fromRound, advancingIds);
  save(eventId, programId, next);
  return ok(next);
}

/** POST heats assign final places */
export async function apiAssignHeatPlaces(
  eventId: string, programId: string,
  places: Record<string, number>
): Promise<ApiResult<BracketState>> {
  await delay();
  const state = load(eventId, programId);
  if (!state) return err("NOT_FOUND", "Fixture not found.");
  const next = assignHeatPlaces(state, places);
  save(eventId, programId, next);
  return ok(next);
}