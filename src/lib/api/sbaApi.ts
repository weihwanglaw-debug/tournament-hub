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

import { ok, err, delay }  from "./_base";
import type { ApiResult }   from "./_base";
import type { SbaRanking }  from "@/types/config";
import sbaData              from "@/data/sba-rankings.json";

// ── In-memory store (mock only) ───────────────────────────────────────────────
const _rankings: SbaRanking[] = sbaData as SbaRanking[];

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

  // ── MOCK ──────────────────────────────────────────────────────────────────
  void filters;  // mock ignores category — all rankings are in one file
  return ok([..._rankings].sort((a, b) => a.ranking - b.ranking));

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const params = new URLSearchParams();
  // if (filters?.category) params.set("category", filters.category);
  // const res = await fetch(`/api/sba/rankings?${params}`);
  // if (!res.ok) return err("FETCH_FAILED", "Failed to load SBA rankings.");
  // return ok(await res.json());
}

/**
 * GET /sba/members/:sbaId
 * Looks up a registered SBA member by ID.
 * Used in EventDetail.tsx to autofill participant name/dob/club.
 */
export async function apiGetSbaMember(sbaId: string): Promise<ApiResult<SbaMember>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  // The static SBA_MASTER in EventDetail.tsx is the mock for this endpoint.
  // Production would query the SBA member database.
  const SBA_MASTER: Record<string, SbaMember> = {
    "SBA-001": { sbaId: "SBA-001", name: "Lee Wei Jie",   dob: "1998-04-12", gender: "Male",   club: "Pasir Ris Badminton Club"  },
    "SBA-002": { sbaId: "SBA-002", name: "Tan Mei Ling",  dob: "2000-07-25", gender: "Female", club: "Tampines Badminton Club"   },
    "SBA-003": { sbaId: "SBA-003", name: "Ravi Kumar",    dob: "1995-11-03", gender: "Male",   club: "Jurong Badminton Club"     },
    "SBA-004": { sbaId: "SBA-004", name: "Wong Xiu Ying", dob: "2002-02-18", gender: "Female", club: "Bishan Sports Club"       },
  };
  const member = SBA_MASTER[sbaId];
  if (!member) return err("NOT_FOUND", `SBA member '${sbaId}' not found.`);
  return ok(member);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/sba/members/${sbaId}`);
  // if (!res.ok) return err("NOT_FOUND", "SBA member not found.");
  // return ok(await res.json());
}

/**
 * GET /sba/members?name=
 * Searches for SBA members by name (for autocomplete).
 */
export async function apiSearchSbaMembers(name: string): Promise<ApiResult<SbaMember[]>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const q = name.toLowerCase();
  const results = _rankings
    .filter(r => r.name.toLowerCase().includes(q))
    .map(r => ({ sbaId: r.sbaId, name: r.name, dob: "", gender: "", club: r.club }));
  return ok(results);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/sba/members?name=${encodeURIComponent(name)}`);
  // if (!res.ok) return err("SEARCH_FAILED", "SBA member search failed.");
  // return ok(await res.json());
}