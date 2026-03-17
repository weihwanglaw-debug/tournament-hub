/**
 * sbaApi.ts — SBA (Singapore Badminton Association) rankings & member lookup.
 *
 * Real backend:
 *   GET /sba/rankings?category=          full rankings list (filterable by category)
 *   GET /sba/members/:sbaId              lookup a single member by SBA ID
 *   GET /sba/members?name=               search members by name
 *
 * Note: In production this may be a read-only proxy to the SBA's own API
 *       rather than data your own backend maintains.
 *
 * Mock: reads from sba-rankings.json (static file).
 * Swap: replace function bodies with fetch() calls.
 *
 * Consumers: Fixtures.tsx (seeding panel), EventDetail.tsx (SBA ID autofill)
 */

import { ok, err, delay, API_BASE, publicHeaders, parseError } from "./_base";
import type { ApiResult }   from "./_base";
import type { SbaRanking }  from "@/types/config";

// ── SBA member shape (superset of SbaRanking; used for autofill) ──────────────
export interface SbaMember {
  sbaId:    string;
  name:     string;
  dob:      string;   // "YYYY-MM-DD"
  gender:   string;
  club:     string;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /sba/rankings
 * Returns the full SBA rankings list (sorted by ranking ASC).
 * Used in the fixture seeding panel to auto-suggest seeds.
 */
export async function apiGetSbaRankings(filters?: {
  category?: string;   // e.g. "MS", "WS", "MD" — future use
}): Promise<ApiResult<SbaRanking[]>> {
  await delay();

  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  const res = await fetch(`${API_BASE}/api/sba/rankings?${params}`, { headers: publicHeaders() });
  if (!res.ok) return err("FETCH_FAILED", "Failed to load SBA rankings.");
  return ok(await res.json());
}

/**
 * GET /sba/members/:sbaId
 * Looks up a registered SBA member by ID.
 * Used in EventDetail.tsx to autofill participant name/dob/club.
 */
export async function apiGetSbaMember(sbaId: string): Promise<ApiResult<SbaMember>> {
  await delay();

  const res = await fetch(`${API_BASE}/api/sba/members/${sbaId}`, { headers: publicHeaders() });
  if (!res.ok) return err("NOT_FOUND", "SBA member not found.");
  return ok(await res.json());
}

/**
 * GET /sba/members?name=
 * Searches for SBA members by name (for autocomplete).
 */
export async function apiSearchSbaMembers(name: string): Promise<ApiResult<SbaMember[]>> {
  await delay();

  const res = await fetch(`${API_BASE}/api/sba/members?name=${encodeURIComponent(name)}`, { headers: publicHeaders() });
  if (!res.ok) return err("SEARCH_FAILED", "SBA member search failed.");
  return ok(await res.json());
}