/**
 * fixtureApi.ts — Real API. All state lives in the backend Fixtures table.
 * The fixture engine (fixtureEngine.ts) is still used locally to compute
 * new states — the backend stores and serves the JSON blob, not the logic.
 */

import type { SeedEntry, BracketState, MatchEntry, FixtureFormatConfig } from "@/types/config";
import {
  generateDraw, generateNextKnockoutRound,
  generateKnockoutFromGroups, swapTeams,
  advanceHeatsRound, saveHeatResult, assignHeatPlaces,
} from "@/lib/fixtureEngine";
import { API_BASE, adminHeaders, parseError } from "@/lib/api/_base";

// ── Result types ──────────────────────────────────────────────────────────────
export interface ApiError { code: string; message: string }
export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError }

function ok<T>(data: T): ApiResult<T>                     { return { data, error: null }; }
function err(code: string, msg: string): ApiResult<never>  { return { data: null, error: { code, message: msg } }; }

// ── Shared save helper — persists any BracketState to the backend ─────────────
async function persist(
  eventId: string, programId: string,
  state: BracketState,
): Promise<ApiResult<BracketState>> {
  const res = await fetch(`${API_BASE}/api/fixtures/${eventId}/${programId}`, {
    method:  "POST",
    headers: adminHeaders(),
    body:    JSON.stringify({
      bracketStateJson: JSON.stringify(state),
      fixtureFormat:    state.format,
      phase:            state.phase,
      isLocked:         state.locked,
    }),
  });
  if (!res.ok) return err("SAVE_FAILED", (await parseError(res)).message);
  return ok(state);
}

// ── GET /api/fixtures/:eventId/:programId ─────────────────────────────────────
export async function apiGetFixture(
  eventId: string,
  programId: string,
): Promise<ApiResult<BracketState | null>> {
  const res = await fetch(`${API_BASE}/api/fixtures/${eventId}/${programId}`, {
    headers: adminHeaders(),
  });
  if (res.status === 404) return ok(null);
  if (!res.ok) return err("FETCH_FAILED", (await parseError(res)).message);
  const data = await res.json();
  if (!data) return ok(null);
  try {
    return ok(JSON.parse(data.bracketStateJson) as BracketState);
  } catch {
    return err("PARSE_FAILED", "Fixture data is corrupted.");
  }
}

// ── POST /api/fixtures/generate ───────────────────────────────────────────────
export async function apiGenerateDraw(
  eventId: string, programId: string,
  seeds: SeedEntry[], config: FixtureFormatConfig,
  prebuiltBracket?: BracketState,
): Promise<ApiResult<BracketState>> {
  if (seeds.length < 2) return err("NOT_ENOUGH", "At least 2 participants required.");
  const seedNums = seeds.map(s => s.seed).filter((s): s is number => s !== null);
  if (seedNums.length !== new Set(seedNums).size)
    return err("DUPLICATE_SEEDS", "Duplicate seed numbers — each must be unique.");
  const state = prebuiltBracket ?? generateDraw(seeds, config);
  return persist(eventId, programId, state);
}

// ── DELETE /api/fixtures/:eventId/:programId ──────────────────────────────────
export async function apiResetFixture(
  eventId: string,
  programId: string,
): Promise<ApiResult<null>> {
  const res = await fetch(`${API_BASE}/api/fixtures/${eventId}/${programId}`, {
    method:  "DELETE",
    headers: adminHeaders(),
  });
  if (!res.ok) return err("DELETE_FAILED", (await parseError(res)).message);
  return ok(null);
}

// ── PATCH score ───────────────────────────────────────────────────────────────
export async function apiSaveScore(
  eventId: string, programId: string, matchId: string,
  updates: Partial<Pick<MatchEntry, "games" | "winner" | "walkover" | "walkoverWinner" | "officials">>,
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  const state = r.data;

  function patchMatches(matches: MatchEntry[]): MatchEntry[] {
    return matches.map(m => m.id !== matchId ? m : {
      ...m, ...updates, status: "Completed" as const, locked: true,
    });
  }
  const next: BracketState = {
    ...state, locked: true,
    matches: patchMatches(state.matches),
    groups:  state.groups.map(g => ({ ...g, matches: patchMatches(g.matches) })),
  };
  return persist(eventId, programId, next);
}

// ── PATCH schedule ────────────────────────────────────────────────────────────
export async function apiUpdateSchedule(
  eventId: string, programId: string, matchId: string,
  s: { courtNo: string; matchDate: string; startTime: string; endTime: string },
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  const state = r.data;

  function patch(matches: MatchEntry[]): MatchEntry[] {
    return matches.map(m => m.id !== matchId ? m : { ...m, ...s });
  }
  const next: BracketState = {
    ...state,
    matches: patch(state.matches),
    groups:  state.groups.map(g => ({ ...g, matches: patch(g.matches) })),
  };
  return persist(eventId, programId, next);
}

// ── POST advance to knockout ──────────────────────────────────────────────────
export async function apiAdvanceToKnockout(
  eventId: string,
  programId: string,
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  const state = r.data;
  if (state.phase !== "group") return err("WRONG_PHASE", "Already in knockout phase.");
  const next: BracketState = {
    ...state,
    phase:   "knockout",
    matches: generateKnockoutFromGroups(state.groups, state.config),
  };
  return persist(eventId, programId, next);
}

// ── POST next knockout round ──────────────────────────────────────────────────
export async function apiAdvanceKnockoutRound(
  eventId: string,
  programId: string,
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  const state = r.data;
  const next: BracketState = {
    ...state,
    matches: [...state.matches, ...generateNextKnockoutRound(state.matches)],
  };
  return persist(eventId, programId, next);
}

// ── POST swap teams ───────────────────────────────────────────────────────────
export async function apiSwapTeams(
  eventId: string, programId: string,
  idA: string, idB: string,
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  if (r.data.locked) return err("LOCKED", "Cannot swap after results have been entered.");
  return persist(eventId, programId, swapTeams(r.data, idA, idB));
}

// ── Heats ─────────────────────────────────────────────────────────────────────
export async function apiSaveHeatResult(
  eventId: string, programId: string,
  roundNumber: number, teamId: string, result: string,
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  return persist(eventId, programId, saveHeatResult(r.data, roundNumber, teamId, result));
}

export async function apiAdvanceHeatsRound(
  eventId: string, programId: string,
  fromRound: number, advancingIds: string[],
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  return persist(eventId, programId, advanceHeatsRound(r.data, fromRound, advancingIds));
}

export async function apiAssignHeatPlaces(
  eventId: string, programId: string,
  places: Record<string, number>,
): Promise<ApiResult<BracketState>> {
  const r = await apiGetFixture(eventId, programId);
  if (r.error) return r as ApiResult<never>;
  if (!r.data)  return err("NOT_FOUND", "Fixture not found.");
  return persist(eventId, programId, assignHeatPlaces(r.data, places));
}