import React, { useState, useMemo } from "react";
import {
  Download, Upload, Plus, Trash2,
  AlertTriangle, Lock, Printer,
  LayoutList, GitBranch,
} from "lucide-react";
import config from "@/data/config.json";
import type {
  TournamentEvent, SeedEntry, BracketState, MatchEntry, FixtureFormat,
} from "@/types/config";
import {
  generateDraw, generateNextKnockoutRound, generateKnockoutFromGroups,
  generateCrossSectionMatches, isBracketLocked, isPhaseComplete, SCORING_RULES,
} from "@/lib/fixtureEngine";
import { BracketView }          from "@/components/admin/fixtures/BracketView";
import { FG, TabBtn, StepCard, CheckRow } from "@/components/admin/fixtures/shared";
import { SeedingTable }         from "@/components/admin/fixtures/SeedingTable";
import { GroupStandingsTable }  from "@/components/admin/fixtures/GroupStandingsTable";
import { MatchTable }           from "@/components/admin/fixtures/MatchTable";
import { ScoreModal }           from "@/components/admin/fixtures/ScoreModal";
import { PrintView }            from "@/components/admin/fixtures/PrintView";

// ── Sample data ───────────────────────────────────────────────────────────────

const SBA_MASTER = [
  { name: "Lee Wei Jie",   ranking: 1 },
  { name: "Tan Mei Ling",  ranking: 2 },
  { name: "Ravi Kumar",    ranking: 3 },
  { name: "Wong Xiu Ying", ranking: 4 },
];

const SAMPLE_SEEDS: SeedEntry[] = [
  { id: "s1", club: "Pasir Ris BC",  participants: ["Lee Wei Jie"],                  seed: 1 },
  { id: "s2", club: "Tampines BC",   participants: ["Tan Ah Kow"],                   seed: null },
  { id: "s3", club: "Jurong BC",     participants: ["Ravi Kumar"],                   seed: 2 },
  { id: "s4", club: "Bishan SC",     participants: ["Wong Beng Huat"],               seed: null },
  { id: "s5", club: "Serangoon BC",  participants: ["Ahmad Farid"],                  seed: 3 },
  { id: "s6", club: "Yishun BC",     participants: ["Lim Jun Wei"],                  seed: null },
  { id: "s7", club: "Tampines BC",   participants: ["Lee Wei Jie", "Tan Mei Ling"],  seed: null },
  { id: "s8", club: "Pasir Ris BC",  participants: ["Ravi Kumar", "Wong Xiu Ying"], seed: null },
];

type ViewMode = "table" | "bracket";

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminFixtures() {
  const events = (config.events as TournamentEvent[]).filter(e => e.isSports);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selEvent,   setSelEvent]   = useState("");
  const [selProgram, setSelProgram] = useState("");
  const [sbaFile,    setSbaFile]    = useState<string | null>(null);
  const [seeds,      setSeeds]      = useState<SeedEntry[]>([]);
  const [bracketState, setBracketState] = useState<BracketState | null>(null);
  const [viewMode,   setViewMode]   = useState<ViewMode>("table");
  const [activeTab,  setActiveTab]  = useState<string>("");
  const [page,       setPage]       = useState(1);
  const [perPage,    setPerPage]    = useState(10);

  // ── Event table filters ───────────────────────────────────────────────────
  const [filterSport, setFilterSport] = useState("");
  const [filterMode,  setFilterMode]  = useState("");

  // ── Score modal state ─────────────────────────────────────────────────────
  const [scoreModal, setScoreModal] = useState<MatchEntry | null>(null);
  const [draft,      setDraft]      = useState<MatchEntry | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selEventObj   = events.find(e => e.id === selEvent);
  const selProgramObj = selEventObj?.programs.find(p => p.id === selProgram);
  const mode          = selEventObj?.fixtureMode || "internal";
  const format        = (selProgramObj?.fixtureFormat ?? "knockout") as FixtureFormat;
  const formatConfig  = selProgramObj?.formatConfig ?? {};
  const scoringRule   = selProgramObj?.scoringRule ?? "badminton_21";
  const regClosed     = selEventObj ? new Date() > new Date(selEventObj.closeDate) : false;
  const minMet        = seeds.length >= (selProgramObj?.minParticipants ?? 0);
  const locked        = bracketState ? isBracketLocked(bracketState) : false;
  const phaseComplete = bracketState ? isPhaseComplete(bracketState) : false;

  const allGroupIds   = bracketState?.groups.map(g => g.id) ?? [];
  const allSectionIds = bracketState?.sections.map(s => s.id) ?? [];
  const isGroupFormat = ["group_knockout", "round_robin", "league", "heats_final"].includes(format);
  const isSectional   = format === "sectional_knockout";

  const maxSeeds    = selProgramObj?.maxSeeds ?? 0;
  const seededList  = seeds.filter(s => s.seed !== null);
  const seedNums    = seededList.map(s => s.seed as number);
  const hasDupSeeds = seedNums.length !== new Set(seedNums).size;
  const overMax     = maxSeeds > 0 && seededList.length > maxSeeds;
  const seedError   = hasDupSeeds ? "Duplicate seed numbers — each must be unique."
                    : overMax     ? `Too many seeds — max ${maxSeeds} allowed.`
                    : null;
  const canGenerate = regClosed && minMet && !seedError;

  // ── Event table ───────────────────────────────────────────────────────────
  const sportTypes     = [...new Set(events.map(e => e.sportType).filter(Boolean))];
  const filteredEvents = events.filter(e =>
    (!filterSport || e.sportType === filterSport) &&
    (!filterMode  || e.fixtureMode === filterMode)
  );
  const hasFilter = !!(filterSport || filterMode);

  // ── Seeding handlers ──────────────────────────────────────────────────────
  const autoAssignSeeding = () =>
    setSeeds(prev => prev.map(entry => {
      const match = SBA_MASTER.find(s =>
        entry.participants.some(p => p.toLowerCase().includes(s.name.toLowerCase()))
      );
      return match ? { ...entry, seed: match.ranking } : entry;
    }));

  const updateSeed = (id: string, val: string) =>
    setSeeds(prev => prev.map(s => s.id === id ? { ...s, seed: val === "" ? null : +val } : s));

  const clearSeed = (id: string) =>
    setSeeds(prev => prev.map(s => s.id === id ? { ...s, seed: null } : s));

  // ── Bracket handlers ──────────────────────────────────────────────────────
  const handleGenerate = () => {
    const state = generateDraw(seeds, format, formatConfig, scoringRule);
    setBracketState(state);
    if (state.groups.length > 0)        setActiveTab(state.groups[0].id);
    else if (state.sections.length > 0) setActiveTab(state.sections[0].id);
    else                                setActiveTab("knockout");
  };

  const handleGenerateKnockout = () => {
    if (!bracketState) return;
    const ko = generateKnockoutFromGroups(bracketState.groups, formatConfig, scoringRule);
    setBracketState(prev => prev ? { ...prev, matches: ko, phase: "knockout" } : prev);
    setActiveTab("knockout");
  };

  const handleGenerateCrossSection = () => {
    if (!bracketState) return;
    const cross = generateCrossSectionMatches(bracketState.sections);
    setBracketState(prev => prev ? { ...prev, matches: cross } : prev);
    setActiveTab("knockout");
  };

  const handleNextRound = () => {
    if (!bracketState) return;
    const next = generateNextKnockoutRound(bracketState.matches);
    if (next.length > 0)
      setBracketState(prev => prev ? { ...prev, matches: [...prev.matches, ...next] } : prev);
  };

  const handleReset = () => { setBracketState(null); setActiveTab(""); setPage(1); };

  // ── Score modal handlers ──────────────────────────────────────────────────
  const openScore = (match: MatchEntry) => {
    setDraft({ ...match, games: match.games.map(g => ({ ...g })) });
    setScoreModal(match);
  };

  const closeScore = () => { setScoreModal(null); setDraft(null); };

  const saveScore = () => {
    if (!draft || !bracketState) return;
    const p1g = draft.games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2).length;
    const p2g = draft.games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1).length;
    let winner: "team1" | "team2" | null = null;
    let status: MatchEntry["status"] = "In Progress";
    if (draft.walkover && draft.walkoverWinner) {
      winner = draft.walkoverWinner as "team1" | "team2"; status = "Walkover";
    } else if (draft.winner) {
      winner = draft.winner; status = "Completed";
    } else if (draft.games.every(g => g.p1 !== "" && g.p2 !== "")) {
      winner = p1g > p2g ? "team1" : "team2"; status = "Completed";
    }
    const updated = { ...draft, winner, status };
    setBracketState(prev => {
      if (!prev) return prev;
      const upd = (list: MatchEntry[]) => list.map(m => m.id === scoreModal!.id ? updated : m);
      return {
        ...prev,
        locked:   true,
        matches:  upd(prev.matches),
        groups:   prev.groups.map(g => ({ ...g, matches: upd(g.matches) })),
        sections: prev.sections.map(s => ({ ...s, matches: upd(s.matches) })),
      };
    });
    closeScore();
  };

  const toggleExpand = (matchId: string) =>
    setBracketState(prev => {
      if (!prev) return prev;
      const tog = (list: MatchEntry[]) => list.map(m => m.id === matchId ? { ...m, expanded: !m.expanded } : m);
      return {
        ...prev,
        matches:  tog(prev.matches),
        groups:   prev.groups.map(g => ({ ...g, matches: tog(g.matches) })),
        sections: prev.sections.map(s => ({ ...s, matches: tog(s.matches) })),
      };
    });

  // ── Match list for current tab ────────────────────────────────────────────
  const tabMatches: MatchEntry[] = useMemo(() => {
    if (!bracketState) return [];
    if (activeTab === "knockout") return bracketState.matches;
    const group = bracketState.groups.find(g => g.id === activeTab);
    if (group) return group.matches;
    const section = bracketState.sections.find(s => s.id === activeTab);
    if (section) return section.matches;
    return bracketState.matches;
  }, [bracketState, activeTab]);

  const totalPages   = Math.max(1, Math.ceil(tabMatches.length / perPage));
  const pagedMatches = tabMatches.slice((page - 1) * perPage, page * perPage);

  // KO round progress
  const koMatches       = bracketState?.matches ?? [];
  const maxKoRound      = koMatches.length > 0 ? Math.max(...koMatches.map(m => m.round)) : 0;
  const currKoRound     = koMatches.filter(m => m.round === maxKoRound);
  const completedInRound = currKoRound.filter(m => m.status === "Completed" || m.status === "Walkover").length;
  const koRoundDone     = currKoRound.length > 0 && currKoRound.every(m => m.status === "Completed" || m.status === "Walkover");
  const canNextRound    = koRoundDone && currKoRound.length > 1;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectEvent = (id: string) => {
    setSelEvent(id); setSelProgram(""); setBracketState(null); setSeeds([]);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="print:p-0">
      <div className="admin-page-title print:hidden"><h1>Fixture Management</h1></div>

      {/* ── EVENT SELECTION TABLE ── */}
      {!selEvent && (
        <div className="print:hidden">
          {/* Filters */}
          <div className="p-5 mb-6" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="grid grid-cols-2 md:flex md:flex-wrap items-end gap-4">
              <FG label="Sport">
                <select className="field-input w-full md:w-40" value={filterSport} onChange={e => setFilterSport(e.target.value)}>
                  <option value="">All Sports</option>
                  {sportTypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FG>
              <FG label="Fixture Mode">
                <select className="field-input w-full md:w-44" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                  <option value="">All Modes</option>
                  <option value="internal">Internal Bracket</option>
                  <option value="external">External</option>
                </select>
              </FG>
              {hasFilter && (
                <button onClick={() => { setFilterSport(""); setFilterMode(""); }}
                  className="btn-outline px-4 py-2 text-xs font-medium col-span-2 md:col-span-1">
                  Clear
                </button>
              )}
            </div>
            {hasFilter && (
              <p className="text-xs mt-3 opacity-50">
                Showing {filteredEvents.length} of {events.length} events
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Event</th><th>Sport</th><th>Mode</th>
                  <th>Programs</th><th>Event Date</th><th>Reg. Closes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 opacity-40 text-sm">No events found.</td></tr>
                )}
                {filteredEvents.map(ev => {
                  const closed = new Date() > new Date(ev.closeDate);
                  return (
                    <tr key={ev.id}>
                      <td className="font-semibold text-sm">{ev.name}</td>
                      <td className="text-sm">{ev.sportType}</td>
                      <td>
                        <span className="text-xs px-2 py-1 font-semibold" style={{
                          backgroundColor: ev.fixtureMode === "external" ? "var(--badge-soon-bg)" : "var(--badge-open-bg)",
                          color:           ev.fixtureMode === "external" ? "var(--badge-soon-text)" : "var(--badge-open-text)",
                        }}>
                          {ev.fixtureMode === "internal" ? "Internal" : "External"}
                        </span>
                      </td>
                      <td className="text-sm">{ev.programs.length}</td>
                      <td className="text-sm opacity-70">{ev.eventStartDate}</td>
                      <td>
                        <span className="text-xs font-semibold" style={{ color: closed ? "var(--badge-open-text)" : "var(--badge-closed-text)" }}>
                          {closed ? "✓ Closed" : ev.closeDate}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => selectEvent(ev.id)}
                          className="btn-primary px-4 py-1.5 text-xs font-semibold">
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredEvents.map(ev => {
              const closed = new Date() > new Date(ev.closeDate);
              return (
                <div key={ev.id} className="p-4" style={{ border: "1px solid var(--color-table-border)" }}>
                  <p className="font-semibold text-sm mb-1">{ev.name}</p>
                  <p className="text-xs opacity-60 mb-3">{ev.sportType} · Closes {ev.closeDate}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-1 font-semibold" style={{
                      backgroundColor: closed ? "var(--badge-open-bg)" : "var(--badge-closed-bg)",
                      color:           closed ? "var(--badge-open-text)" : "var(--badge-closed-text)",
                    }}>
                      {closed ? "Reg. Closed" : "Reg. Open"}
                    </span>
                    <button onClick={() => selectEvent(ev.id)}
                      className="btn-primary px-4 py-1.5 text-xs font-semibold">
                      Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── EVENT DETAIL ── */}
      {selEvent && (
        <>
          <button
            onClick={() => { setSelEvent(""); setSelProgram(""); setBracketState(null); setSeeds([]); }}
            className="btn-back flex items-center gap-1.5 text-xs px-3 py-1.5 mb-5 print:hidden"
          >
            ← Back to Events
          </button>

          {/* Event info + program selector */}
          <div className="p-5 mb-6 print:hidden" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide opacity-50 mb-1">Selected Event</p>
                <h2 className="font-bold text-base mb-2">{selEventObj?.name}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-2 py-1 font-semibold" style={{
                    backgroundColor: mode === "external" ? "var(--badge-soon-bg)" : "var(--badge-open-bg)",
                    color:           mode === "external" ? "var(--badge-soon-text)" : "var(--badge-open-text)",
                  }}>
                    {mode === "internal" ? "Internal Bracket" : "External (TournamentSoftware)"}
                  </span>
                  <span className="text-xs opacity-60">{selEventObj?.sportType}</span>
                  <span className="text-xs opacity-40">·</span>
                  <span className="text-xs opacity-60">Reg. closes {selEventObj?.closeDate}</span>
                </div>
              </div>
              <div className="flex-shrink-0 w-56">
                <FG label="Select Program">
                  <select className="field-input w-full" value={selProgram}
                    onChange={e => {
                      const pid = e.target.value;
                      setSelProgram(pid);
                      setBracketState(null);
                      setActiveTab("");
                      const prog = selEventObj?.programs.find(p => p.id === pid);
                      setSeeds((prog as any)?.participantSeeds ?? SAMPLE_SEEDS);
                    }}>
                    <option value="">— Choose a program —</option>
                    {selEventObj?.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FG>
                {selProgram && (
                  <span className="block text-xs mt-2 px-2 py-1 font-semibold w-fit"
                    style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                    {SCORING_RULES[scoringRule]?.label ?? scoringRule} · {format}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!selProgram && (
            <div className="text-center py-16 opacity-40 text-sm print:hidden">
              ↑ Select a program above to manage its fixtures.
            </div>
          )}

          {selProgram && (
            <>
              {/* ── EXTERNAL MODE ── */}
              {mode === "external" && (
                <div className="space-y-8">
                  <StepCard n={1} title="Import SBA Player Ranking File"
                    description="Upload the official SBA file to update the master ranking list.">
                    <label className="inline-flex items-center gap-2 btn-outline px-5 py-2.5 text-sm font-medium cursor-pointer">
                      <Upload className="h-4 w-4" /> Import SBA File (.xlsx / .csv)
                      <input type="file" accept=".xlsx,.csv" className="hidden"
                        onChange={e => setSbaFile(e.target.files?.[0]?.name || null)} />
                    </label>
                    {sbaFile && <p className="text-xs mt-2 opacity-60">Loaded: {sbaFile}</p>}
                  </StepCard>
                  <StepCard n={2} title="Assign Seeding to Participants">
                    <SeedingTable
                      seeds={seeds} maxSeeds={maxSeeds} showAutoAssign={true}
                      seedError={seedError} onAutoAssign={autoAssignSeeding}
                      onUpdateSeed={updateSeed} onClearSeed={clearSeed}
                    />
                  </StepCard>
                  <StepCard n={3} title="Export Participant List to TournamentSoftware">
                    <button className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                      <Download className="h-4 w-4" /> Export Participant List with Seeding
                    </button>
                  </StepCard>
                </div>
              )}

              {/* ── INTERNAL MODE ── */}
              {mode === "internal" && (
                <div className="space-y-6">
                  {/* Locked banner */}
                  {locked && (
                    <div className="flex items-center gap-3 px-5 py-3"
                      style={{ backgroundColor: "var(--badge-soon-bg)", border: "1px solid var(--color-table-border)" }}>
                      <Lock className="h-4 w-4 flex-shrink-0" style={{ color: "var(--badge-soon-text)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--badge-soon-text)" }}>
                        Bracket locked — competition in progress. Draw cannot be changed.
                      </span>
                    </div>
                  )}

                  {/* ── Pre-generation ── */}
                  {!bracketState && (
                    <>
                      <div className="p-5 space-y-2"
                        style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                        <p className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Requirements to Generate Bracket</p>
                        <CheckRow ok={regClosed} label={regClosed
                          ? "Registration is closed"
                          : `Registration still open (closes ${selEventObj?.closeDate})`} />
                        <CheckRow ok={minMet} label={minMet
                          ? `Minimum participants met (${seeds.length} registered)`
                          : `Need at least ${selProgramObj?.minParticipants ?? "?"} participants (${seeds.length} registered)`} />
                      </div>

                      {!["round_robin", "league"].includes(format) ? (
                        <SeedingTable
                          seeds={seeds} maxSeeds={maxSeeds} showAutoAssign={false}
                          seedError={seedError} onAutoAssign={autoAssignSeeding}
                          onUpdateSeed={updateSeed} onClearSeed={clearSeed}
                        />
                      ) : (
                        <p className="text-xs opacity-50 px-1">
                          ℹ Seeding is not used for {format === "league" ? "league" : "round-robin"} draw — all participants are placed equally.
                        </p>
                      )}

                      <div className="flex items-center gap-4">
                        <button onClick={handleGenerate} disabled={!canGenerate}
                          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                          Generate Bracket
                        </button>
                        {seedError && (
                          <p className="text-xs font-semibold" style={{ color: "var(--badge-closed-text)" }}>{seedError}</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Post-generation ── */}
                  {bracketState && (
                    <>
                      {/* View mode toggle + actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <div className="flex gap-0" style={{ border: "1px solid var(--color-table-border)" }}>
                          {(["table", "bracket"] as ViewMode[]).map(vm => (
                            <button key={vm} onClick={() => setViewMode(vm)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: viewMode === vm ? "var(--color-primary)" : "transparent",
                                color: viewMode === vm ? "var(--color-hero-text)" : "var(--color-body-text)",
                                borderRight: vm === "table" ? "1px solid var(--color-table-border)" : undefined,
                              }}>
                              {vm === "table" ? <LayoutList className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                              {vm === "table" ? "Table View" : "Bracket View"}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => window.print()}
                            className="btn-outline flex items-center gap-1.5 px-4 py-2 text-sm font-medium">
                            <Printer className="h-4 w-4" /> Print
                          </button>
                          {!locked && (
                            <button onClick={handleReset}
                              className="btn-outline flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
                              style={{ color: "var(--badge-closed-text)", borderColor: "var(--badge-closed-text)" }}>
                              Reset Draw
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Phase tabs (table view only) */}
                      {viewMode === "table" && (allGroupIds.length > 0 || allSectionIds.length > 0) && (
                        <div className="flex gap-0 overflow-x-auto print:hidden"
                          style={{ borderBottom: "2px solid var(--color-table-border)" }}>
                          {allGroupIds.map(id => (
                            <TabBtn key={id} active={activeTab === id} onClick={() => setActiveTab(id)}>
                              {bracketState.groups.find(g => g.id === id)?.name ?? id}
                            </TabBtn>
                          ))}
                          {allSectionIds.map(id => (
                            <TabBtn key={id} active={activeTab === id} onClick={() => setActiveTab(id)}>
                              {bracketState.sections.find(s => s.id === id)?.name ?? id}
                            </TabBtn>
                          ))}
                          {bracketState.matches.length > 0 && (
                            <TabBtn active={activeTab === "knockout"} onClick={() => setActiveTab("knockout")}>
                              {format === "heats_final" ? "Finals" : "Knockout Phase"}
                            </TabBtn>
                          )}
                        </div>
                      )}

                      {/* Group standings */}
                      {activeTab !== "knockout" && isGroupFormat && bracketState.groups.length > 0 && (
                        <GroupStandingsTable
                          group={bracketState.groups.find(g => g.id === activeTab) ?? bracketState.groups[0]}
                          scoringRule={scoringRule}
                        />
                      )}

                      {/* Advance phase + round progress */}
                      <div className="flex flex-wrap gap-3 items-center print:hidden">
                        {isGroupFormat && bracketState.phase === "group" && phaseComplete && bracketState.matches.length === 0 && (
                          <button onClick={handleGenerateKnockout}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                            Generate Knockout Phase →
                          </button>
                        )}
                        {isSectional && bracketState.matches.length === 0 && allSectionIds.every(id => {
                          const sec = bracketState.sections.find(s => s.id === id);
                          return sec?.matches.every(m => m.status === "Completed" || m.status === "Walkover");
                        }) && (
                          <button onClick={handleGenerateCrossSection}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                            Generate Cross-Section Draw →
                          </button>
                        )}
                        {(activeTab === "knockout" || format === "knockout") && canNextRound && (
                          <button onClick={handleNextRound}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                            Generate Next Round →
                          </button>
                        )}
                        {(activeTab === "knockout" || format === "knockout") && maxKoRound > 0 && (
                          <span className="text-xs px-3 py-1.5 font-semibold" style={{
                            backgroundColor: koRoundDone ? "var(--badge-open-bg)" : "var(--badge-soon-bg)",
                            color:           koRoundDone ? "var(--badge-open-text)" : "var(--badge-soon-text)",
                          }}>
                            Round {maxKoRound} — {koRoundDone
                              ? "All matches complete ✓"
                              : `${completedInRound} / ${currKoRound.length} matches done`}
                          </span>
                        )}
                      </div>

                      {/* Match table / bracket view */}
                      {viewMode === "table" && (
                        <MatchTable
                          matches={pagedMatches}
                          page={page} totalPages={totalPages}
                          perPage={perPage} total={tabMatches.length}
                          onSetPage={setPage}
                          onSetPerPage={n => { setPerPage(n); setPage(1); }}
                          onOpenScore={openScore}
                          onToggleExpand={toggleExpand}
                        />
                      )}
                      {viewMode === "bracket" && (
                        <BracketView bracketState={bracketState} format={format} />
                      )}

                      <PrintView
                        eventName={selEventObj?.name ?? ""}
                        programName={selProgramObj?.name ?? ""}
                        bracketState={bracketState}
                      />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Score modal */}
      <ScoreModal
        open={!!scoreModal}
        draft={draft}
        scoringRule={scoringRule}
        isLocked={locked}
        onClose={closeScore}
        onSave={saveScore}
        onChangeDraft={setDraft}
      />
    </div>
  );
}