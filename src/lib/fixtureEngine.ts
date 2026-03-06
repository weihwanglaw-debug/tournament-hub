/**
 * fixtureEngine.ts
 * Pure bracket-generation functions — no React, no state, no side effects.
 * All functions take plain objects and return plain objects.
 * Safe to call from any context (component, hook, test, API route).
 */

import type {
  FixtureFormat,
  FixtureFormatConfig,
  ScoringRuleId,
  TiebreakCriteria,
  SeedEntry,
  TeamEntry,
  MatchEntry,
  MatchPhase,
  GameScore,
  GroupEntry,
  GroupStanding,
  SectionEntry,
  BracketState,
} from "@/types/config";

// ── ID generation (deterministic, no crypto dependency) ───────────────────────

let _seq = 0;
function nextId(prefix: string): string {
  _seq++;
  return `${prefix}-${String(_seq).padStart(4, "0")}`;
}
export function resetIdSequence() { _seq = 0; }

// ── Team helpers ──────────────────────────────────────────────────────────────

function seedToTeam(s: SeedEntry): TeamEntry {
  return { id: s.id, label: s.club, participants: s.participants, seed: s.seed ?? undefined };
}

function blankMatch(
  team1: TeamEntry,
  team2: TeamEntry,
  round: number,
  phase: MatchPhase,
  extras: Partial<MatchEntry> = {}
): MatchEntry {
  return {
    id: nextId("M"),
    phase,
    round,
    roundLabel: "",   // caller fills this in after all matches known
    team1,
    team2,
    games: [{ p1: "", p2: "" }],
    winner: null,
    walkover: false,
    walkoverWinner: "",
    startTime: "",
    endTime: "",
    officials: [],
    status: "Scheduled",
    expanded: false,
    ...extras,
  };
}

// ── Round label helper ────────────────────────────────────────────────────────

/**
 * Returns a human-readable round label.
 * matchesInRound = total matches in that round.
 * e.g. 1 → "Final", 2 → "Semi-Final", 4 → "Quarter-Final",
 *      8 → "Round of 16", 16 → "Round of 32"
 */
export function getRoundLabel(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:  return "Final";
    case 2:  return "Semi-Final";
    case 4:  return "Quarter-Final";
    default: return `Round of ${matchesInRound * 2}`;
  }
}

/** Applies roundLabel to every match based on how many matches share that round. */
function applyRoundLabels(matches: MatchEntry[]): MatchEntry[] {
  const roundCounts: Record<number, number> = {};
  for (const m of matches) roundCounts[m.round] = (roundCounts[m.round] ?? 0) + 1;
  return matches.map(m => ({ ...m, roundLabel: getRoundLabel(roundCounts[m.round]) }));
}

// ── Seeding distribution ──────────────────────────────────────────────────────

/** Returns seeded entries first (sorted), then unseeded in original order. */
function sortedSeeds(seeds: SeedEntry[]): SeedEntry[] {
  const seeded   = seeds.filter(s => s.seed != null).sort((a, b) => a.seed! - b.seed!);
  const unseeded = seeds.filter(s => s.seed == null);
  return [...seeded, ...unseeded];
}

/**
 * Classic bracket positioning: seed 1 vs seed N, seed 2 vs seed N-1, …
 * Returns pairs of [top, bottom] in bracket order.
 */
function bracketPairs(teams: TeamEntry[]): [TeamEntry, TeamEntry][] {
  const n = nextPowerOf2(teams.length);
  // Pad with "BYE" if not a power of 2
  const padded = [...teams];
  while (padded.length < n) {
    padded.push({ id: `bye-${padded.length}`, label: "BYE", participants: ["BYE"] });
  }
  const pairs: [TeamEntry, TeamEntry][] = [];
  for (let i = 0; i < n / 2; i++) {
    pairs.push([padded[i], padded[n - 1 - i]]);
  }
  return pairs;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Snake seeding across K buckets.
 * Distributes seeds so the top seeds land in different sections/groups.
 * Returns teams[][] — one array per bucket.
 */
function snakeDistribute(teams: TeamEntry[], numBuckets: number): TeamEntry[][] {
  const buckets: TeamEntry[][] = Array.from({ length: numBuckets }, () => []);
  let direction = 1;
  let bucketIdx = 0;
  for (const team of teams) {
    buckets[bucketIdx].push(team);
    bucketIdx += direction;
    if (bucketIdx >= numBuckets || bucketIdx < 0) {
      direction *= -1;
      bucketIdx += direction;
    }
  }
  return buckets;
}

// ═════════════════════════════════════════════════════════════════════════════
// KNOCKOUT
// ═════════════════════════════════════════════════════════════════════════════

function generateKnockoutMatches(teams: TeamEntry[], startRound = 1): MatchEntry[] {
  const pairs = bracketPairs(teams);
  const matches: MatchEntry[] = pairs
    .filter(([t1, t2]) => t1.label !== "BYE" && t2.label !== "BYE")
    .map(([t1, t2]) => blankMatch(t1, t2, startRound, "knockout"));
  return applyRoundLabels(matches);
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTIONAL KNOCKOUT
// ═════════════════════════════════════════════════════════════════════════════

function generateSectionalDraw(seeds: SeedEntry[], config: FixtureFormatConfig): SectionEntry[] {
  const numSections = config.numSections ?? 2;
  const teams = sortedSeeds(seeds).map(seedToTeam);
  const buckets = snakeDistribute(teams, numSections);
  const sectionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return buckets.map((bucket, i) => {
    const id = sectionLabels[i];
    const matches = generateKnockoutMatches(bucket).map(m => ({ ...m, sectionId: id, phase: "section" as MatchPhase }));
    return { id, name: `Section ${id}`, teams: bucket, matches };
  });
}

/** After all section matches are done, pair section winners into cross-section KO. */
export function generateCrossSectionMatches(sections: SectionEntry[]): MatchEntry[] {
  const winners: TeamEntry[] = sections.map(sec => {
    const finalMatch = sec.matches.reduce((max, m) => m.round > max.round ? m : max, sec.matches[0]);
    return finalMatch.winner === "team1" ? finalMatch.team1 : finalMatch.team2;
  });
  const matches = generateKnockoutMatches(winners, 1).map(m => ({ ...m, sectionId: undefined }));
  return matches;
}

// ═════════════════════════════════════════════════════════════════════════════
// GROUP + KNOCKOUT
// ═════════════════════════════════════════════════════════════════════════════

/** Generates all round-robin pairings within a single group. */
function generateRoundRobinPairs(teams: TeamEntry[], groupId: string): MatchEntry[] {
  const matches: MatchEntry[] = [];
  let round = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push(blankMatch(teams[i], teams[j], round, "group", { groupId, roundLabel: `Group ${groupId} — Match ${matches.length + 1}` }));
      round++;
    }
  }
  return matches;
}

function generateGroupDraw(seeds: SeedEntry[], config: FixtureFormatConfig): GroupEntry[] {
  const numGroups = config.numGroups ?? 2;
  const teams = sortedSeeds(seeds).map(seedToTeam);
  const buckets = snakeDistribute(teams, numGroups);
  const groupLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return buckets.map((bucket, i) => {
    const id = groupLabels[i];
    const matches = generateRoundRobinPairs(bucket, id);
    return { id, name: `Group ${id}`, teams: bucket, matches };
  });
}

// ── Group standings ───────────────────────────────────────────────────────────

/** Parses a score string like "21" to a number, returns 0 if blank/invalid. */
function pts(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

export function computeGroupStandings(
  group: GroupEntry,
  scoringRule: ScoringRuleId = "badminton_21",
  tiebreakOrder: TiebreakCriteria[] = ["head_to_head", "game_ratio", "point_ratio"]
): GroupStanding[] {
  const pointsForWin  = 2;
  const pointsForDraw = 0;

  const map: Record<string, GroupStanding> = {};
  for (const team of group.teams) {
    map[team.id] = {
      team,
      played: 0, wins: 0, losses: 0, draws: 0,
      gamesFor: 0, gamesAgainst: 0,
      pointsFor: 0, pointsAgainst: 0,
      points: 0, rank: 0,
    };
  }

  for (const match of group.matches) {
    if (match.status !== "Completed" && match.status !== "Walkover") continue;
    const s1 = map[match.team1.id];
    const s2 = map[match.team2.id];
    if (!s1 || !s2) continue;

    s1.played++;
    s2.played++;

    for (const g of match.games) {
      if (g.p1 === "" || g.p2 === "") continue;
      const a = pts(g.p1), b = pts(g.p2);
      s1.pointsFor     += a; s1.pointsAgainst += b;
      s2.pointsFor     += b; s2.pointsAgainst += a;
      if (a > b) { s1.gamesFor++; s2.gamesAgainst++; }
      else if (b > a) { s2.gamesFor++; s1.gamesAgainst++; }
    }

    if (match.winner === "team1") {
      s1.wins++; s1.points += pointsForWin;
      s2.losses++;
    } else if (match.winner === "team2") {
      s2.wins++; s2.points += pointsForWin;
      s1.losses++;
    } else {
      s1.draws++; s1.points += pointsForDraw;
      s2.draws++; s2.points += pointsForDraw;
    }
  }

  const standings = Object.values(map);

  // Head-to-head lookup: teamAId → teamBId → winner ("A" | "B" | "draw")
  const h2h: Record<string, Record<string, "A" | "B" | "draw">> = {};
  for (const match of group.matches) {
    if (match.status !== "Completed") continue;
    const aId = match.team1.id, bId = match.team2.id;
    if (!h2h[aId]) h2h[aId] = {};
    if (!h2h[bId]) h2h[bId] = {};
    if (match.winner === "team1")  { h2h[aId][bId] = "A"; h2h[bId][aId] = "B"; }
    else if (match.winner === "team2") { h2h[aId][bId] = "B"; h2h[bId][aId] = "A"; }
    else { h2h[aId][bId] = "draw"; h2h[bId][aId] = "draw"; }
  }

  standings.sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) return b.points - a.points;

    // 2. Tiebreak criteria in declared order
    for (const criterion of tiebreakOrder) {
      let diff = 0;
      switch (criterion) {
        case "head_to_head": {
          const result = h2h[a.team.id]?.[b.team.id];
          if (result === "A") return -1;
          if (result === "B") return 1;
          break;
        }
        case "game_ratio":
          diff = (b.gamesFor / (b.played || 1)) - (a.gamesFor / (a.played || 1));
          break;
        case "point_ratio":
          diff = (b.pointsFor / (b.pointsAgainst || 1)) - (a.pointsFor / (a.pointsAgainst || 1));
          break;
        case "goal_difference":
          diff = (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
          break;
        case "goals_scored":
          diff = b.pointsFor - a.pointsFor;
          break;
      }
      if (diff !== 0) return diff > 0 ? 1 : -1;
    }

    // 5. Coin toss (random in mock — deterministic sort by team id for stability)
    return a.team.id.localeCompare(b.team.id);
  });

  standings.forEach((s, i) => { s.rank = i + 1; });
  return standings;
}

// ── Cross-group knockout (after all groups complete) ──────────────────────────

/**
 * Generates the knockout phase after groups finish.
 * Supports BWF, standard, and FIFA pairing styles.
 * advancePerGroup: how many teams advance from each group (1 or 2).
 */
export function generateKnockoutFromGroups(
  groups: GroupEntry[],
  config: FixtureFormatConfig,
  scoringRule: ScoringRuleId = "badminton_21",
  tiebreakOrder: TiebreakCriteria[] = ["head_to_head", "game_ratio", "point_ratio"]
): MatchEntry[] {
  const advance = config.advancePerGroup ?? 2;
  const pairing = config.crossGroupPairing ?? "bwf";

  // Get ranked finishers per group
  const ranked: TeamEntry[][] = groups.map(g => {
    const standings = computeGroupStandings(g, scoringRule, tiebreakOrder);
    return standings.slice(0, advance).map(s => s.team);
  });

  // Build advanced list: ranked[n][position] → 1st from each group, then 2nd from each group
  const advancedByPosition: TeamEntry[][] = Array.from({ length: advance }, (_, pos) =>
    groups.map((_, gi) => ranked[gi][pos]).filter(Boolean)
  );

  const ko1sts = advancedByPosition[0] ?? [];  // group winners
  const ko2nds = advancedByPosition[1] ?? [];  // group runners-up

  let pairs: [TeamEntry, TeamEntry][] = [];

  if (pairing === "bwf" && groups.length === 4 && advance === 2) {
    // BWF: A1 vs B2, B1 vs A2, C1 vs D2, D1 vs C2
    pairs = [
      [ko1sts[0], ko2nds[1]], // A1 vs B2
      [ko1sts[1], ko2nds[0]], // B1 vs A2
      [ko1sts[2], ko2nds[3]], // C1 vs D2
      [ko1sts[3], ko2nds[2]], // D1 vs C2
    ];
  } else if (pairing === "fifa" && groups.length === 4 && advance === 2) {
    // FIFA World Cup: A1 vs B2, C1 vs D2, B1 vs A2, D1 vs C2
    pairs = [
      [ko1sts[0], ko2nds[1]],
      [ko1sts[2], ko2nds[3]],
      [ko1sts[1], ko2nds[0]],
      [ko1sts[3], ko2nds[2]],
    ];
  } else {
    // Standard: 1st plays 2nd in rank order across groups
    const allAdvanced = [...ko1sts, ...ko2nds];
    const matchPairs = bracketPairs(allAdvanced);
    pairs = matchPairs;
  }

  const matches: MatchEntry[] = pairs.map(([t1, t2]) =>
    blankMatch(t1, t2, 1, "knockout")
  );
  return applyRoundLabels(matches);
}

// ── Advance knockout round ────────────────────────────────────────────────────

/**
 * Given completed KO matches from the current max round,
 * generates the next round's matches.
 * Returns [] if no completed matches or only 1 match (Final already played).
 */
export function generateNextKnockoutRound(knockoutMatches: MatchEntry[]): MatchEntry[] {
  if (knockoutMatches.length === 0) return [];

  const maxRound = Math.max(...knockoutMatches.map(m => m.round));
  const currentRound = knockoutMatches.filter(m => m.round === maxRound);

  const allDone = currentRound.every(m => m.status === "Completed" || m.status === "Walkover");
  if (!allDone || currentRound.length <= 1) return [];

  const winners: TeamEntry[] = currentRound.map(m =>
    m.winner === "team1" ? m.team1 : m.winner === "team2" ? m.team2 : m.team1 // fallback
  );

  const nextMatches = generateKnockoutMatches(winners, maxRound + 1);
  return nextMatches;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generates the initial BracketState from a seeded participant list.
 * This is the single function Fixtures.tsx calls when admin clicks "Generate Bracket".
 */
export function generateDraw(
  seeds: SeedEntry[],
  format: FixtureFormat,
  config: FixtureFormatConfig,
  scoringRule: ScoringRuleId = "badminton_21"
): BracketState {
  resetIdSequence();

  const base: BracketState = {
    format,
    config,
    scoringRule,
    locked: false,
    phase: "knockout",
    groups: [],
    sections: [],
    matches: [],
    seeds,
  };

  switch (format) {
    case "knockout": {
      const teams = sortedSeeds(seeds).map(seedToTeam);
      return {
        ...base,
        phase: "knockout",
        matches: generateKnockoutMatches(teams),
      };
    }

    case "sectional_knockout": {
      const sections = generateSectionalDraw(seeds, config);
      return {
        ...base,
        phase: "knockout", // sections share the knockout phase label
        sections,
        matches: [],       // cross-section matches generated after sections complete
      };
    }

    case "group_knockout": {
      const groups = generateGroupDraw(seeds, config);
      return {
        ...base,
        phase: "group",
        groups,
        matches: [],       // KO phase generated after groups complete
      };
    }

    case "round_robin": {
      // All matches in groups, no KO phase
      const groups = generateGroupDraw(seeds, { ...config, numGroups: 1 });
      return {
        ...base,
        phase: "group",
        groups,
        matches: [],
      };
    }

    case "league": {
      // Same as round_robin but homeAndAway doubles the matches
      const groups = generateGroupDraw(seeds, { ...config, numGroups: 1 });
      if (config.homeAndAway) {
        // Duplicate each match with teams swapped
        const homeAway: GroupEntry[] = groups.map(g => ({
          ...g,
          matches: [
            ...g.matches,
            ...g.matches.map(m => ({ ...m, id: nextId("M"), team1: m.team2, team2: m.team1 })),
          ],
        }));
        return { ...base, phase: "group", groups: homeAway, matches: [] };
      }
      return { ...base, phase: "group", groups, matches: [] };
    }

    case "heats_final": {
      // Heats are treated as groups, finals are the KO phase
      const numHeats = config.numHeats ?? 2;
      const groups = generateGroupDraw(seeds, { ...config, numGroups: numHeats });
      return { ...base, phase: "group", groups, matches: [] };
    }

    default:
      return base;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SCORING RULE DEFINITIONS (for display and validation)
// ═════════════════════════════════════════════════════════════════════════════

export interface ScoringRule {
  id: ScoringRuleId;
  label: string;
  setLabel: string;
  pointLabel: string;
  setsToWin?: number;
  pointsToWin?: number;
  mustWinBy?: number;
  maxPoints?: number;
  winCondition: "best_of_sets" | "time_based" | "fastest_time";
  allowDraw?: boolean;
  sortOrder?: "asc" | "desc";
}

export const SCORING_RULES: Record<ScoringRuleId, ScoringRule> = {
  badminton_21: {
    id: "badminton_21",
    label: "Badminton — 21pts",
    setLabel: "Game",
    pointLabel: "Points",
    setsToWin: 2,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
    winCondition: "best_of_sets",
  },
  badminton_30: {
    id: "badminton_30",
    label: "Badminton — 30pts",
    setLabel: "Game",
    pointLabel: "Points",
    setsToWin: 2,
    pointsToWin: 30,
    mustWinBy: 1,
    winCondition: "best_of_sets",
  },
  football_90: {
    id: "football_90",
    label: "Football — 90min",
    setLabel: "Half",
    pointLabel: "Goals",
    winCondition: "time_based",
    allowDraw: true,
  },
  tennis_sets: {
    id: "tennis_sets",
    label: "Tennis — Sets",
    setLabel: "Set",
    pointLabel: "Games",
    setsToWin: 2,
    winCondition: "best_of_sets",
  },
  swimming_time: {
    id: "swimming_time",
    label: "Swimming — Time",
    setLabel: "Heat",
    pointLabel: "Time (s)",
    winCondition: "fastest_time",
    sortOrder: "asc",
  },
  sets_3: {
    id: "sets_3",
    label: "Best of 3 Sets",
    setLabel: "Set",
    pointLabel: "Points",
    setsToWin: 2,
    winCondition: "best_of_sets",
  },
  sets_5: {
    id: "sets_5",
    label: "Best of 5 Sets",
    setLabel: "Set",
    pointLabel: "Points",
    setsToWin: 3,
    winCondition: "best_of_sets",
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// UTILITY: is bracket locked?
// ═════════════════════════════════════════════════════════════════════════════

/** Returns true if any match in any phase has a score entered (not just Scheduled). */
export function isBracketLocked(state: BracketState): boolean {
  const allMatches = [
    ...state.matches,
    ...state.groups.flatMap(g => g.matches),
    ...state.sections.flatMap(s => s.matches),
  ];
  return allMatches.some(m => m.status !== "Scheduled");
}

/** Returns true if all matches in the current active phase are complete. */
export function isPhaseComplete(state: BracketState): boolean {
  if (state.phase === "group") {
    return state.groups.every(g =>
      g.matches.every(m => m.status === "Completed" || m.status === "Walkover")
    );
  }
  if (state.phase === "knockout") {
    return state.matches.every(m => m.status === "Completed" || m.status === "Walkover");
  }
  return false;
}