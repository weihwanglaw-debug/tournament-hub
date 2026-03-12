/**
 * Fixtures.tsx — Fixture Management
 *
 * Program-level table. Each row = one program.
 * Columns: Event | Program | Mode | Event Date | Draw | Schedule | Results | Action
 *
 * fixtureMode:
 *   internal     → full wizard + Draw/Schedule/Results tabs
 *   external     → seeding assignment + CSV export only
 *   not_required → read-only row, no action
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Download, Search, X } from "lucide-react";
import config  from "@/data/config.json";
import sbaData from "@/data/sba-rankings.json";
import type { TournamentEvent, SeedEntry, BracketState, MatchEntry, WizardConfig, SbaRanking } from "@/types/config";
import { isBracketLocked, isPhaseComplete, getAllMatches, getCurrentHeatRound } from "@/lib/fixtureEngine";
import {
  apiGenerateDraw, apiGetFixture, apiResetFixture,
  apiSaveScore, apiUpdateSchedule,
  apiAdvanceKnockoutRound, apiAdvanceToKnockout, apiSwapTeams,
  apiSaveHeatResult, apiAdvanceHeatsRound, apiAssignHeatPlaces,
} from "@/lib/fixtureApi";
import type { ApiError } from "@/lib/fixtureApi";
import { getProgramFixtureInfo } from "@/lib/fixtureStatus";
import { exportParticipantsCsv } from "@/lib/exportCsv";

import { FixtureWizard } from "@/components/admin/fixtures/WizardSteps";
import type { WizardResult } from "@/components/admin/fixtures/WizardSteps";
import { DrawTab }     from "@/components/admin/fixtures/DrawTab";
import { ScheduleTab } from "@/components/admin/fixtures/ScheduleTab";
import { ResultsTab }  from "@/components/admin/fixtures/ResultsTab";
import { ScoreModal }  from "@/components/admin/fixtures/ScoreModal";
import { HeatsTab }    from "@/components/admin/fixtures/HeatsTab";
import { FG }          from "@/components/admin/fixtures/shared";

const SBA_RANKINGS: SbaRanking[] = sbaData as SbaRanking[];

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "draw" | "schedule" | "results" | "heats";

interface ProgramRow {
  eventId:     string;
  eventName:   string;
  programId:   string;
  programName: string;
  mode:        string;
  sportType:   string;
  startDate:   string;
  endDate:     string;
  closeDate:   string;
  participants: SeedEntry[];
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: "error" | "success"; message: string }
let _tseq = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], msg: string) => {
    const id = ++_tseq;
    setToasts(p => [...p, { id, type, message: msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);
  const toast = { error: (m: string) => push("error", m), success: (m: string) => push("success", m) };
  const Toasts = useCallback(() => (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: "12px 16px", maxWidth: 380, fontSize: 13, fontWeight: 500,
          border: `1px solid ${t.type === "error" ? "var(--badge-closed-text)" : "var(--badge-open-text)"}`,
          backgroundColor: t.type === "error" ? "var(--badge-closed-bg)" : "var(--badge-open-bg)",
          color: t.type === "error" ? "var(--badge-closed-text)" : "var(--badge-open-text)",
          boxShadow: "0 4px 16px rgba(0,0,0,.15)",
        }}>{t.message}</div>
      ))}
    </div>
  ), [toasts]);
  return { toast, Toasts };
}

// ── Status badges ─────────────────────────────────────────────────────────────

function DrawBadge({ eventId, programId, closeDate, mode }: { eventId: string; programId: string; closeDate: string; mode: string }) {
  const info = useMemo(
    () => getProgramFixtureInfo(eventId, { id: programId, name: "" }, closeDate, mode),
    [eventId, programId, closeDate, mode]
  );
  if (mode === "not_required") return <span className="text-xs opacity-30">Not Required</span>;
  if (mode === "external")     return <span className="text-xs opacity-50 italic">External</span>;
  if (info.status === "reg_open") return <span className="text-xs opacity-30">Reg. Open</span>;
  if (info.status === "ready")    return <span className="text-xs font-bold" style={{ color: "var(--badge-closed-text)" }}>● Pending</span>;
  return <span className="text-xs font-bold" style={{ color: "var(--badge-open-text)" }}>✓ Generated</span>;
}

function ResultsBadge({ bracket }: { bracket: BracketState | null }) {
  if (!bracket) return <span className="text-xs opacity-30">—</span>;
  if (bracket.format === "heats") {
    const done  = (bracket.heatRounds ?? []).filter(r => r.isComplete).length;
    const total = (bracket.heatRounds ?? []).length;
    if (done === total) return <span className="text-xs font-bold" style={{ color: "var(--badge-open-text)" }}>✓ Complete</span>;
    if (done > 0)       return <span className="text-xs font-bold" style={{ color: "var(--badge-soon-text)" }}>{done}/{total} rounds</span>;
    return <span className="text-xs opacity-40">Pending</span>;
  }
  const all   = getAllMatches(bracket);
  const done  = all.filter(m => m.status === "Completed" || m.status === "Walkover").length;
  const total = all.length;
  if (total === 0)      return <span className="text-xs opacity-30">—</span>;
  if (done === total)   return <span className="text-xs font-bold" style={{ color: "var(--badge-open-text)" }}>✓ {done}/{total}</span>;
  if (done > 0)         return <span className="text-xs font-bold" style={{ color: "var(--badge-soon-text)" }}>{done}/{total}</span>;
  return <span className="text-xs opacity-40">0/{total}</span>;
}

// ── External seeding panel ────────────────────────────────────────────────────

import { Shuffle } from "lucide-react";

function ExternalPanel({ participants, sbaRankings, isBadminton, eventName, programName }: {
  participants: SeedEntry[]; sbaRankings: SbaRanking[]; isBadminton: boolean;
  eventName: string; programName: string;
}) {
  const [numSeeds, setNumSeeds] = useState(0);
  const [seeds, setSeeds]       = useState<SeedEntry[]>(participants.map(p => ({ ...p, seed: null })));
  const [seeding, setSeeding]   = useState(false);

  const sbaById = useMemo(() => { const m: Record<string, SbaRanking> = {}; for (const r of sbaRankings) m[r.sbaId] = r; return m; }, [sbaRankings]);
  const getSba  = (s: SeedEntry) => s.sbaId ? sbaById[s.sbaId] : null;

  const autoSeed = () => {
    const withSba = seeds.filter(s => s.sbaId && sbaById[s.sbaId]);
    if (!withSba.length) { alert("No participants have a registered SBA ID. Assign seeds manually."); return; }
    const canAssign = Math.min(numSeeds, withSba.length);
    const sorted = [...withSba].sort((a, b) => (sbaById[b.sbaId!]?.accumulatedScore ?? 0) - (sbaById[a.sbaId!]?.accumulatedScore ?? 0));
    setSeeds(seeds.map(s => { const rank = sorted.findIndex(x => x.id === s.id); return { ...s, seed: rank >= 0 && rank < canAssign ? rank + 1 : null }; }));
    if (canAssign < numSeeds) alert(`Only ${canAssign}/${numSeeds} seeds auto-assigned — ${numSeeds - canAssign} participants have no SBA ID.`);
  };

  const setSeedVal = (id: string, v: string) => setSeeds(seeds.map(s => s.id === id ? { ...s, seed: v === "" ? null : +v } : s));
  const seedNums = seeds.filter(s => s.seed !== null).map(s => s.seed as number);
  const hasDups  = seedNums.length !== new Set(seedNums).size;

  return (
    <div className="space-y-5">
      <div className="p-4" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
        <p className="font-bold text-sm mb-1">External Tournament Mode</p>
        <p className="text-xs opacity-60">Assign seeds then export the participant list for your external system.</p>
      </div>

      {!seeding ? (
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-semibold mb-2 opacity-60">Number of Seeds</label>
            <select className="field-input w-52" value={numSeeds} onChange={e => setNumSeeds(+e.target.value)}>
              <option value={0}>No seeding</option>
              {Array.from({ length: Math.min(participants.length, 8) }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Top {n} seed{n > 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            {numSeeds > 0 && (
              <button onClick={() => setSeeding(true)} className="btn-primary px-5 py-2.5 text-sm font-semibold">
                Assign Seeds →
              </button>
            )}
            <button onClick={() => exportParticipantsCsv(eventName, programName, seeds, isBadminton)}
              className="btn-outline flex items-center gap-2 px-4 py-2.5 text-sm">
              <Download className="h-4 w-4" /> Export (no seeding)
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs font-semibold">{seeds.filter(s => s.seed !== null).length}/{numSeeds} seeds assigned</span>
            <div className="flex gap-2">
              <button onClick={autoSeed} className="btn-outline flex items-center gap-1.5 px-3 py-2 text-xs">
                <Shuffle className="h-3.5 w-3.5" /> Auto-fill
              </button>
              <button onClick={() => setSeeding(false)} className="btn-outline px-3 py-2 text-xs">← Back</button>
            </div>
          </div>
          {hasDups && <p className="text-xs px-3 py-2 font-semibold" style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)" }}>⚠ Duplicate seed numbers.</p>}
          <div className="overflow-auto" style={{ border: "1px solid var(--color-table-border)", maxHeight: 360 }}>
            <table className="trs-table">
              <thead style={{ position: "sticky", top: 0 }}>
                <tr><th>Club</th><th>Players</th>{isBadminton && <th>SBA ID</th>}{isBadminton && <th>SBA Score</th>}<th style={{ width: 120 }}>Seed</th></tr>
              </thead>
              <tbody>
                {seeds.map(s => {
                  const sba = getSba(s); const isDup = s.seed !== null && seeds.filter(x => x.seed === s.seed).length > 1;
                  return (
                    <tr key={s.id} style={isDup ? { backgroundColor: "var(--badge-closed-bg)" } : undefined}>
                      <td className="font-medium text-sm">{s.club}</td>
                      <td className="text-xs opacity-60">{s.participants.join(" / ")}</td>
                      {isBadminton && <td className="font-mono text-xs">{s.sbaId || <span className="opacity-25 italic">No SBA ID</span>}</td>}
                      {isBadminton && <td className="text-right font-mono text-xs">{sba ? <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>{sba.accumulatedScore.toLocaleString()}</span> : <span className="opacity-25">—</span>}</td>}
                      <td>
                        <div className="flex items-center gap-1">
                          <input type="number" min={1} max={numSeeds} className="field-input py-1 text-sm text-center"
                            style={{ width: "4rem", borderColor: isDup ? "var(--badge-closed-text)" : undefined }}
                            value={s.seed ?? ""} placeholder="—" onChange={e => setSeedVal(s.id, e.target.value)} />
                          {s.seed !== null && <button onClick={() => setSeedVal(s.id, "")} className="text-xs opacity-30 hover:opacity-70">✕</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button disabled={hasDups} onClick={() => exportParticipantsCsv(eventName, programName, seeds, isBadminton)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
            <Download className="h-4 w-4" /> Export with Seeds
          </button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main page
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminFixtures() {
  const allEvents = (config.events as TournamentEvent[]).filter(e => e.isSports);
  const { toast, Toasts } = useToasts();

  // Build flat program rows
  const allRows: ProgramRow[] = useMemo(() =>
    allEvents.flatMap(ev =>
      ev.programs.map(p => ({
        eventId:      ev.id,
        eventName:    ev.name,
        programId:    p.id,
        programName:  p.name,
        mode:         ev.fixtureMode,
        sportType:    ev.sportType,
        startDate:    ev.eventStartDate,
        endDate:      ev.eventEndDate,
        closeDate:    ev.closeDate,
        participants: (p.participantSeeds ?? []) as SeedEntry[],
      }))
    ), [allEvents]
  );

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterName, setFilterName] = useState("");
  const [filterMode, setFilterMode] = useState<"" | "internal" | "external" | "not_required">("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo,   setFilterTo]   = useState("");

  const filtered = useMemo(() => allRows.filter(r => {
    if (filterName && !r.eventName.toLowerCase().includes(filterName.toLowerCase()) &&
                      !r.programName.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterMode && r.mode !== filterMode) return false;
    if (filterFrom && r.startDate < filterFrom) return false;
    if (filterTo   && r.endDate   > filterTo)   return false;
    return true;
  }), [allRows, filterName, filterMode, filterFrom, filterTo]);

  const hasFilters = filterName || filterMode || filterFrom || filterTo;

  // ── Selected program ──────────────────────────────────────────────────────
  const [selRow,       setSelRow]       = useState<ProgramRow | null>(null);
  const [bracketState, setBracketState] = useState<BracketState | null>(null);
  const [showWizard,   setShowWizard]   = useState(false);
  const [activeTab,    setActiveTab]    = useState<Tab>("draw");
  const [loading,      setLoading]      = useState(false);

  // ── Score modal ───────────────────────────────────────────────────────────
  const [scoreModal, setScoreModal] = useState<MatchEntry | null>(null);
  const [draft,      setDraft]      = useState<MatchEntry | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isBadminton  = selRow?.sportType?.toLowerCase() === "badminton";
  const locked       = bracketState ? isBracketLocked(bracketState) : false;
  const koMatches    = bracketState?.matches ?? [];
  const maxKoRound   = koMatches.length ? Math.max(...koMatches.map(m => m.round)) : 0;
  const currKoRound  = koMatches.filter(m => m.round === maxKoRound);
  const koRoundDone  = currKoRound.length > 0 && currKoRound.every(m => m.status === "Completed" || m.status === "Walkover");
  const canNextRound = koRoundDone && currKoRound.length > 1;
  const isGroupKo    = bracketState?.format === "group_knockout";
  const groupsDone   = isGroupKo && bracketState ? isPhaseComplete(bracketState) && bracketState.phase === "group" : false;
  const showNextRound = groupsDone || canNextRound;
  const isHeats      = bracketState?.format === "heats";

  // ── Helpers ───────────────────────────────────────────────────────────────
  const apiErr = (e: ApiError | null) => { if (e) toast.error(e.message); };
  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true); try { return await fn(); } finally { setLoading(false); }
  };

  // ── Load bracket when row selected ───────────────────────────────────────
  useEffect(() => {
    if (!selRow) { setBracketState(null); return; }
    let cancelled = false;
    apiGetFixture(selRow.eventId, selRow.programId).then(r => {
      if (!cancelled) setBracketState(r.data ?? null);
    });
    return () => { cancelled = true; };
  }, [selRow?.eventId, selRow?.programId]);

  // ── Bracket cached results display in table — refresh on save ────────────
  const [tableVersion, setTableVersion] = useState(0);
  const refreshTable = () => setTableVersion(v => v + 1);

  // ── Wizard complete ───────────────────────────────────────────────────────
  const handleWizardComplete = async ({ config: wizConfig, seeds, bracket: prebuilt }: WizardResult) => {
    if (!selRow) return;
    const result = await withLoading(() => apiGenerateDraw(selRow.eventId, selRow.programId, seeds, wizConfig, prebuilt));
    if (result.error) { apiErr(result.error); return; }
    setBracketState(result.data!);
    setShowWizard(false);
    setActiveTab(isHeats ? "heats" : "draw");
    refreshTable();
    toast.success("Fixture saved.");
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!selRow || !window.confirm("Reset this fixture? All match data will be lost.")) return;
    await withLoading(() => apiResetFixture(selRow.eventId, selRow.programId));
    setBracketState(null); setShowWizard(false); refreshTable(); toast.success("Fixture reset.");
  };

  // ── Next round ────────────────────────────────────────────────────────────
  const handleNextRound = async () => {
    if (!selRow) return;
    const result = groupsDone
      ? await withLoading(() => apiAdvanceToKnockout(selRow.eventId, selRow.programId))
      : await withLoading(() => apiAdvanceKnockoutRound(selRow.eventId, selRow.programId));
    if (result.error) { apiErr(result.error); return; }
    setBracketState(result.data!);
    if (groupsDone) setActiveTab("draw");
    toast.success(groupsDone ? "Knockout phase generated." : "Next round generated.");
  };

  // ── Score modal ───────────────────────────────────────────────────────────
  const openScore  = (m: MatchEntry) => { setDraft({ ...m, games: m.games.map(g => ({ ...g })) }); setScoreModal(m); };
  const closeScore = () => { setScoreModal(null); setDraft(null); };
  const saveScore  = async () => {
    if (!draft || !selRow) return;
    const result = await withLoading(() => apiSaveScore(selRow.eventId, selRow.programId, draft.id, {
      games: draft.games, winner: draft.walkover ? null : draft.winner,
      walkover: draft.walkover, walkoverWinner: draft.walkoverWinner, officials: draft.officials,
    }));
    if (result.error) { apiErr(result.error); return; }
    setBracketState(result.data!); refreshTable(); closeScore();
  };

  // ── Schedule update ───────────────────────────────────────────────────────
  const handleUpdateSchedule = async (matchId: string, s: { courtNo: string; matchDate: string; startTime: string; endTime: string }) => {
    if (!selRow) return;
    const result = await apiUpdateSchedule(selRow.eventId, selRow.programId, matchId, s);
    if (result.error) { apiErr(result.error); return; }
    setBracketState(result.data!);
  };

  // ── Swap ──────────────────────────────────────────────────────────────────
  const handleSwap = async (idA: string, idB: string) => {
    if (!selRow) return;
    const result = await apiSwapTeams(selRow.eventId, selRow.programId, idA, idB);
    if (result.error) { apiErr(result.error); return; }
    setBracketState(result.data!); toast.success("Players swapped.");
  };

  // ── Heats handlers ────────────────────────────────────────────────────────
  const handleSaveHeatResult = async (roundNumber: number, teamId: string, result: string) => {
    if (!selRow) return;
    const r = await apiSaveHeatResult(selRow.eventId, selRow.programId, roundNumber, teamId, result);
    if (r.error) { apiErr(r.error); return; }
    setBracketState(r.data!);
  };
  const handleAdvanceHeats = async (fromRound: number, advancingIds: string[]) => {
    if (!selRow) return;
    const r = await withLoading(() => apiAdvanceHeatsRound(selRow.eventId, selRow.programId, fromRound, advancingIds));
    if (r.error) { apiErr(r.error); return; }
    setBracketState(r.data!); refreshTable(); toast.success("Round advanced.");
  };
  const handleAssignPlaces = async (places: Record<string, number>) => {
    if (!selRow) return;
    const r = await withLoading(() => apiAssignHeatPlaces(selRow.eventId, selRow.programId, places));
    if (r.error) { apiErr(r.error); return; }
    setBracketState(r.data!); refreshTable(); toast.success("Final places saved.");
  };

  const selectRow = (row: ProgramRow) => {
    setSelRow(row); setBracketState(null); setShowWizard(false); setActiveTab("draw");
  };
  const backToList = () => { setSelRow(null); setBracketState(null); setShowWizard(false); };

  // ── Tab list ──────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string }[] = bracketState?.format === "heats"
    ? [{ key: "heats", label: "Heats" }]
    : [
        { key: "draw",     label: "Draw" },
        { key: "schedule", label: "Schedule" },
        { key: "results",  label: (() => {
          const all = bracketState ? getAllMatches(bracketState) : [];
          const done = all.filter(m => m.status === "Completed" || m.status === "Walkover").length;
          return `Results${all.length ? ` (${done}/${all.length})` : ""}`;
        })() },
      ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="print:p-0">
      {loading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, backgroundColor: "rgba(0,0,0,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600 }}>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-primary)" }} />
            Processing…
          </div>
        </div>
      )}
      <Toasts />
      <div className="admin-page-title print:hidden"><h1>Fixture Management</h1></div>

      {/* ════════════════════════════════════════════════════════════════════
          PROGRAM LIST
      ════════════════════════════════════════════════════════════════════ */}
      {!selRow && (
        <div className="print:hidden">
          {/* Filter bar */}
          <div className="flex flex-wrap items-end gap-3 p-4 mb-4"
            style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-semibold mb-1.5 opacity-60">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-40" />
                <input className="field-input pl-8 w-full" placeholder="Event or program name…"
                  value={filterName} onChange={e => setFilterName(e.target.value)} />
              </div>
            </div>
            <FG label="Mode">
              <select className="field-input w-40" value={filterMode}
                onChange={e => setFilterMode(e.target.value as typeof filterMode)}>
                <option value="">All Modes</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="not_required">Not Required</option>
              </select>
            </FG>
            <FG label="Date From">
              <input type="date" className="field-input" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            </FG>
            <FG label="Date To">
              <input type="date" className="field-input" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            </FG>
            {hasFilters && (
              <button onClick={() => { setFilterName(""); setFilterMode(""); setFilterFrom(""); setFilterTo(""); }}
                className="btn-outline flex items-center gap-1.5 px-3 py-2 text-xs self-end">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          <p className="text-xs opacity-40 mb-3">{filtered.length} program{filtered.length !== 1 ? "s" : ""}{hasFilters ? " matching filters" : ""}</p>

          <div style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Program</th>
                  <th>Mode</th>
                  <th>Event Dates</th>
                  <th>Draw</th>
                  <th>Schedule</th>
                  <th>Results</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-sm opacity-30">No programs match the current filters.</td></tr>
                ) : filtered.map(row => {
                  const bracket = (() => { try { const r = localStorage.getItem(`fixture_${row.eventId}_${row.programId}`); return r ? JSON.parse(r) as BracketState : null; } catch { return null; } })();
                  const info    = getProgramFixtureInfo(row.eventId, { id: row.programId, name: row.programName }, row.closeDate, row.mode);
                  const urgent  = info.status === "ready" || info.status === "in_progress";
                  return (
                    <tr key={`${row.eventId}-${row.programId}`}
                      style={urgent ? { borderLeft: "3px solid var(--color-primary)" } : undefined}>
                      <td>
                        <p className="font-medium text-sm">{row.eventName}</p>
                        <p className="text-xs opacity-40">{row.sportType}</p>
                      </td>
                      <td className="font-semibold text-sm">{row.programName}</td>
                      <td>
                        <span className="text-xs px-2 py-0.5 font-semibold"
                          style={{
                            backgroundColor: row.mode === "external" ? "var(--badge-soon-bg)" : row.mode === "not_required" ? "var(--color-row-hover)" : "var(--badge-open-bg)",
                            color:           row.mode === "external" ? "var(--badge-soon-text)" : row.mode === "not_required" ? "var(--color-body-text)" : "var(--badge-open-text)",
                            opacity:         row.mode === "not_required" ? 0.5 : 1,
                          }}>
                          {row.mode === "internal" ? "Internal" : row.mode === "external" ? "External" : "Not Required"}
                        </span>
                      </td>
                      <td className="text-xs opacity-60 whitespace-nowrap">{row.startDate} → {row.endDate}</td>
                      <td><DrawBadge eventId={row.eventId} programId={row.programId} closeDate={row.closeDate} mode={row.mode} /></td>
                      <td>
                        {row.mode === "not_required" || row.mode === "external" || !bracket
                          ? <span className="text-xs opacity-30">—</span>
                          : (() => {
                              const all = getAllMatches(bracket);
                              const sched = all.filter(m => m.matchDate).length;
                              return <span className="text-xs opacity-60">{sched}/{all.length} scheduled</span>;
                            })()}
                      </td>
                      <td><ResultsBadge bracket={row.mode === "not_required" ? null : bracket} /></td>
                      <td>
                        {row.mode === "not_required"
                          ? <span className="text-xs opacity-30">—</span>
                          : <button onClick={() => selectRow(row)} className="btn-primary px-4 py-1.5 text-xs font-semibold">Manage</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          PROGRAM DETAIL
      ════════════════════════════════════════════════════════════════════ */}
      {selRow && (
        <>
          <button onClick={backToList} className="btn-back flex items-center gap-1.5 text-xs px-3 py-1.5 mb-5 print:hidden">
            ← All Programs
          </button>

          {/* Program header */}
          <div className="p-5 mb-5 print:hidden"
            style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs opacity-40 mb-0.5">{selRow.eventName}</p>
                <h2 className="font-bold text-base mb-1.5">{selRow.programName}</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold px-2 py-0.5"
                    style={{
                      backgroundColor: selRow.mode === "external" ? "var(--badge-soon-bg)" : "var(--badge-open-bg)",
                      color:           selRow.mode === "external" ? "var(--badge-soon-text)" : "var(--badge-open-text)",
                    }}>
                    {selRow.mode === "internal" ? "Internal" : selRow.mode === "external" ? "External" : "Not Required"}
                  </span>
                  <span className="opacity-50">{selRow.sportType}</span>
                  <span className="opacity-30">·</span>
                  <span className="opacity-50">{selRow.startDate} → {selRow.endDate}</span>
                  <span className="opacity-30">·</span>
                  <span className="opacity-50">{selRow.participants.length} entries</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportParticipantsCsv(selRow.eventName, selRow.programName, selRow.participants, isBadminton)}
                  className="btn-outline flex items-center gap-1.5 px-4 py-2 text-xs">
                  <Download className="h-3.5 w-3.5" /> Export Participants
                </button>
                {bracketState && !locked && (
                  <button onClick={handleReset}
                    className="btn-outline px-4 py-2 text-xs"
                    style={{ color: "var(--badge-closed-text)", borderColor: "var(--badge-closed-text)" }}>
                    Reset Draw
                  </button>
                )}
                {bracketState && showNextRound && (
                  <button onClick={handleNextRound} disabled={loading}
                    className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-40">
                    {groupsDone ? "Generate KO Phase →" : "Next Round →"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* External mode */}
          {selRow.mode === "external" && (
            <ExternalPanel
              participants={selRow.participants} sbaRankings={SBA_RANKINGS}
              isBadminton={isBadminton} eventName={selRow.eventName} programName={selRow.programName}
            />
          )}

          {/* Internal mode */}
          {selRow.mode === "internal" && (
            <>
              {/* No fixture yet */}
              {!bracketState && !showWizard && (
                <div className="py-12 flex flex-col items-center gap-4"
                  style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                  <p className="text-sm opacity-50">No fixture generated for this program.</p>
                  {selRow.participants.length >= 2
                    ? <button onClick={() => setShowWizard(true)} className="btn-primary px-6 py-2.5 text-sm font-semibold">Generate Fixture →</button>
                    : <p className="text-xs opacity-30">Need at least 2 registered entries.</p>}
                </div>
              )}

              {/* Wizard */}
              {showWizard && !bracketState && (
                <div className="p-6" style={{ border: "2px solid var(--color-primary)" }}>
                  <FixtureWizard
                    participants={selRow.participants}
                    sbaRankings={SBA_RANKINGS}
                    isBadminton={isBadminton}
                    onComplete={handleWizardComplete}
                    onCancel={() => setShowWizard(false)}
                  />
                </div>
              )}

              {/* Fixture tabs */}
              {bracketState && (
                <>
                  <div className="tab-bar mb-6 print:hidden">
                    {tabs.map(t => (
                      <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`tab-btn ${activeTab === t.key ? "active" : ""}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "draw" && (
                    <DrawTab bracketState={bracketState} eventName={selRow.eventName} programName={selRow.programName}
                      onOpenScore={openScore} onSwap={handleSwap} />
                  )}
                  {activeTab === "schedule" && (
                    <ScheduleTab bracketState={bracketState} eventName={selRow.eventName} programName={selRow.programName}
                      onUpdateSchedule={handleUpdateSchedule} onOpenScore={openScore} />
                  )}
                  {activeTab === "results" && (
                    <ResultsTab bracketState={bracketState} eventName={selRow.eventName} programName={selRow.programName}
                      onOpenScore={openScore} />
                  )}
                  {activeTab === "heats" && (
                    <HeatsTab bracketState={bracketState} eventName={selRow.eventName} programName={selRow.programName}
                      onSaveResult={handleSaveHeatResult} onAdvanceRound={handleAdvanceHeats}
                      onAssignPlaces={handleAssignPlaces} />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      <ScoreModal open={!!scoreModal} draft={draft} isLocked={locked}
        onClose={closeScore} onSave={saveScore} onChangeDraft={setDraft} />
    </div>
  );
}