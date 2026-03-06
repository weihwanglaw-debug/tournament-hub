import { useState, useMemo } from "react";
import {
  Download, Upload, Plus, Trash2, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Users, CheckCircle, Lock, Printer,
  LayoutList, GitBranch,
} from "lucide-react";
import config from "@/data/config.json";
import type {
  TournamentEvent, SeedEntry, BracketState, MatchEntry, TeamEntry,
  Official, GroupEntry, SectionEntry, GroupStanding, FixtureFormat,
} from "@/types/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/TableControls";
import { Switch } from "@/components/ui/switch";
import {
  generateDraw, generateNextKnockoutRound, generateKnockoutFromGroups,
  generateCrossSectionMatches, computeGroupStandings, isBracketLocked,
  isPhaseComplete, SCORING_RULES,
} from "@/lib/fixtureEngine";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_SUGGESTIONS = ["Referee", "Linesman", "Umpire", "Court Marshal", "Scorer", "Ball Boy"];

const SBA_MASTER = [
  { sbaId: "SBA-001", name: "Lee Wei Jie",   club: "Pasir Ris BC",  ranking: 1 },
  { sbaId: "SBA-002", name: "Tan Mei Ling",  club: "Tampines BC",   ranking: 2 },
  { sbaId: "SBA-003", name: "Ravi Kumar",    club: "Jurong BC",     ranking: 3 },
  { sbaId: "SBA-004", name: "Wong Xiu Ying", club: "Bishan SC",     ranking: 4 },
];

const SAMPLE_SEEDS: SeedEntry[] = [
  { id: "s1", club: "Pasir Ris BC", participants: ["Lee Wei Jie"],                 seed: 1 },
  { id: "s2", club: "Tampines BC",  participants: ["Tan Ah Kow"],                  seed: null },
  { id: "s3", club: "Jurong BC",    participants: ["Ravi Kumar"],                  seed: 2 },
  { id: "s4", club: "Bishan SC",    participants: ["Wong Beng Huat"],              seed: null },
  { id: "s5", club: "Serangoon BC", participants: ["Ahmad Farid"],                 seed: 3 },
  { id: "s6", club: "Yishun BC",    participants: ["Lim Jun Wei"],                 seed: null },
  { id: "s7", club: "Tampines BC",  participants: ["Lee Wei Jie", "Tan Mei Ling"], seed: null },
  { id: "s8", club: "Pasir Ris BC", participants: ["Ravi Kumar", "Wong Xiu Ying"],seed: null },
];

function genId() { return Math.random().toString(36).slice(2, 8); }

type ViewMode = "table" | "bracket" | "print";

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminFixtures() {
  const events = (config.events as TournamentEvent[]).filter(e => e.isSports);

  const [selEvent,   setSelEvent]   = useState("");
  const [selProgram, setSelProgram] = useState("");
  const [sbaFile,    setSbaFile]    = useState<string | null>(null);
  const [seeds,      setSeeds]      = useState<SeedEntry[]>([]);
  const [bracketState, setBracketState] = useState<BracketState | null>(null);
  const [viewMode,   setViewMode]   = useState<ViewMode>("table");
  const [activeTab,  setActiveTab]  = useState<string>(""); // group/section id or "knockout"
  const [page,  setPage]  = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Event table filter
  const [filterSport,  setFilterSport]  = useState("");
  const [filterMode,   setFilterMode]   = useState("");

  // Score modal
  const [scoreModal, setScoreModal] = useState<MatchEntry | null>(null);
  const [draft,      setDraft]      = useState<MatchEntry | null>(null);

  // Derived values
  const selEventObj   = events.find(e => e.id === selEvent);
  const selProgramObj = selEventObj?.programs.find(p => p.id === selProgram);
  const mode          = selEventObj?.fixtureMode || "internal";
  const isBadminton   = selEventObj?.sportType === "Badminton";
  const format        = (selProgramObj?.fixtureFormat ?? "knockout") as FixtureFormat;
  const formatConfig  = selProgramObj?.formatConfig ?? {};
  const scoringRule   = selProgramObj?.scoringRule ?? "badminton_21";
  const regClosed     = selEventObj ? new Date() > new Date(selEventObj.closeDate) : false;
  const minMet        = seeds.length >= (selProgramObj?.minParticipants ?? 0);

  const locked        = bracketState ? isBracketLocked(bracketState) : false;
  const phaseComplete = bracketState ? isPhaseComplete(bracketState) : false;

  // Auto-set active tab when bracket is generated
  const allGroupIds    = bracketState?.groups.map(g => g.id) ?? [];
  const allSectionIds  = bracketState?.sections.map(s => s.id) ?? [];
  const isGroupFormat  = ["group_knockout", "round_robin", "league", "heats_final"].includes(format);
  const isSectional    = format === "sectional_knockout";

  

  // ── Seeding ───────────────────────────────────────────────────────────────
  const autoAssignSeeding = () => {
    setSeeds(prev => prev.map(entry => {
      const match = SBA_MASTER.find(s =>
        entry.participants.some(p => p.toLowerCase().includes(s.name.toLowerCase()))
      );
      return match ? { ...entry, seed: match.ranking } : entry;
    }));
  };
  const updateSeed = (id: string, val: string) =>
    setSeeds(prev => prev.map(s => s.id === id ? { ...s, seed: val === "" ? null : +val } : s));
  const clearSeed = (id: string) =>
    setSeeds(prev => prev.map(s => s.id === id ? { ...s, seed: null } : s));

  // ── Generate initial bracket ──────────────────────────────────────────────
  const handleGenerate = () => {
    const state = generateDraw(seeds, format, formatConfig, scoringRule);
    setBracketState(state);
    // Set default tab
    if (state.groups.length > 0) setActiveTab(state.groups[0].id);
    else if (state.sections.length > 0) setActiveTab(state.sections[0].id);
    else setActiveTab("knockout");
  };

  // ── After group phase: generate KO ───────────────────────────────────────
  const handleGenerateKnockout = () => {
    if (!bracketState) return;
    const koMatches = generateKnockoutFromGroups(
      bracketState.groups, formatConfig, scoringRule
    );
    setBracketState(prev => prev ? { ...prev, matches: koMatches, phase: "knockout" } : prev);
    setActiveTab("knockout");
  };

  // ── After section phase: generate cross-section ───────────────────────────
  const handleGenerateCrossSection = () => {
    if (!bracketState) return;
    const crossMatches = generateCrossSectionMatches(bracketState.sections);
    setBracketState(prev => prev ? { ...prev, matches: crossMatches } : prev);
    setActiveTab("knockout");
  };

  // ── Advance KO round ──────────────────────────────────────────────────────
  const handleNextRound = () => {
    if (!bracketState) return;
    const next = generateNextKnockoutRound(bracketState.matches);
    if (next.length > 0) {
      setBracketState(prev => prev ? { ...prev, matches: [...prev.matches, ...next] } : prev);
    }
  };

  // ── Score modal ───────────────────────────────────────────────────────────
  const openScore = (match: MatchEntry) => {
    setDraft({ ...match, games: match.games.map(g => ({ ...g })) });
    setScoreModal(match);
  };

  const updateGame = (idx: number, side: "p1" | "p2", val: string) => {
    if (!draft) return;
    setDraft({ ...draft, games: draft.games.map((g, i) => i === idx ? { ...g, [side]: val } : g) });
  };
  const addGame    = () => draft && setDraft({ ...draft, games: [...draft.games, { p1: "", p2: "" }] });
  const removeGame = (idx: number) => {
    if (!draft || draft.games.length <= 1) return;
    setDraft({ ...draft, games: draft.games.filter((_, i) => i !== idx) });
  };
  const addOfficial    = () => draft && setDraft({ ...draft, officials: [...draft.officials, { id: genId(), role: "", name: "" }] });
  const updateOfficial = (idx: number, k: keyof Official, v: string) =>
    draft && setDraft({ ...draft, officials: draft.officials.map((o, i) => i === idx ? { ...o, [k]: v } : o) });
  const removeOfficial = (idx: number) =>
    draft && setDraft({ ...draft, officials: draft.officials.filter((_, i) => i !== idx) });

  const saveScore = () => {
    if (!draft || !bracketState) return;
    const p1g = draft.games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2).length;
    const p2g = draft.games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1).length;
    let winner: "team1" | "team2" | null = null;
    let status: MatchEntry["status"] = "In Progress";
    if (draft.walkover && draft.walkoverWinner) { winner = draft.walkoverWinner as "team1" | "team2"; status = "Walkover"; }
    else if (draft.winner) { winner = draft.winner; status = "Completed"; }
    else if (draft.games.every(g => g.p1 !== "" && g.p2 !== "")) {
      winner = p1g > p2g ? "team1" : "team2"; status = "Completed";
    }
    const updated = { ...draft, winner, status };

    // Update match in correct location (knockout matches, group matches, or section matches)
    setBracketState(prev => {
      if (!prev) return prev;
      const updateInList = (list: MatchEntry[]) =>
        list.map(m => m.id === scoreModal!.id ? updated : m);
      return {
        ...prev,
        locked: true, // First save always locks the bracket
        matches: updateInList(prev.matches),
        groups:  prev.groups.map(g => ({ ...g, matches: updateInList(g.matches) })),
        sections:prev.sections.map(s => ({ ...s, matches: updateInList(s.matches) })),
      };
    });
    setScoreModal(null); setDraft(null);
  };

  const toggleExpand = (matchId: string) => {
    setBracketState(prev => {
      if (!prev) return prev;
      const toggle = (list: MatchEntry[]) =>
        list.map(m => m.id === matchId ? { ...m, expanded: !m.expanded } : m);
      return {
        ...prev,
        matches:  toggle(prev.matches),
        groups:   prev.groups.map(g => ({ ...g, matches: toggle(g.matches) })),
        sections: prev.sections.map(s => ({ ...s, matches: toggle(s.matches) })),
      };
    });
  };

  // ── Current tab's match list for table view ───────────────────────────────
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

  // Knockout matches for "Generate Next Round" logic
  const koMatches    = bracketState?.matches ?? [];
  const maxKoRound   = koMatches.length > 0 ? Math.max(...koMatches.map(m => m.round)) : 0;
  const currKoRound  = koMatches.filter(m => m.round === maxKoRound);
  const koRoundDone  = currKoRound.length > 0 && currKoRound.every(m => m.status === "Completed" || m.status === "Walkover");
  const canNextRound = koRoundDone && currKoRound.length > 1;

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setBracketState(null);
    setActiveTab("");
    setPage(1);
  };

  // ═══════════════════════════════════════════════════════════════════════════

  // Filtered events for table
  const sportTypes = [...new Set(events.map(e => e.sportType).filter(Boolean))];
  const filteredEvents = events.filter(e =>
    (!filterSport || e.sportType === filterSport) &&
    (!filterMode  || e.fixtureMode === filterMode)
  );

  // Seed validation
  const maxSeeds     = selProgramObj?.maxSeeds ?? 0;
  const seededList   = seeds.filter(s => s.seed !== null);
  const seedNums     = seededList.map(s => s.seed as number);
  const hasDupSeeds  = seedNums.length !== new Set(seedNums).size;
  const overMaxSeeds = maxSeeds > 0 && seededList.length > maxSeeds;
  const seedError    = hasDupSeeds ? "Duplicate seed numbers — each seed must be unique."
                     : overMaxSeeds ? `Too many seeded players — max ${maxSeeds} allowed.`
                     : null;
  const canGenerate  = regClosed && minMet && !bracketState && !seedError;

  // Match progress for current KO round
  const completedInRound = currKoRound.filter(m => m.status === "Completed" || m.status === "Walkover").length;

  return (
    <div className="print:p-0">
      <div className="admin-page-title print:hidden"><h1>Fixture Management</h1></div>

      {/* ── Event Table ── */}
      {!selEvent && (
        <div className="print:hidden">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select className="field-input w-48" value={filterSport} onChange={e => setFilterSport(e.target.value)}>
              <option value="">All Sports</option>
              {sportTypes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="field-input w-44" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
              <option value="">All Modes</option>
              <option value="internal">Internal Bracket</option>
              <option value="external">External</option>
            </select>
          </div>
          <div style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Sport</th>
                  <th>Mode</th>
                  <th>Programs</th>
                  <th>Event Date</th>
                  <th>Reg. Closes</th>
                  <th></th>
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
                        <span className="text-xs px-2 py-1 font-semibold"
                          style={{ backgroundColor: ev.fixtureMode === "external" ? "var(--badge-soon-bg)" : "var(--badge-open-bg)", color: ev.fixtureMode === "external" ? "var(--badge-soon-text)" : "var(--badge-open-text)" }}>
                          {ev.fixtureMode === "internal" ? "Internal" : "External"}
                        </span>
                      </td>
                      <td className="text-sm">{ev.programs.length}</td>
                      <td className="text-sm opacity-70">{ev.eventStartDate}</td>
                      <td>
                        <span className="text-xs" style={{ color: closed ? "var(--badge-open-text)" : "var(--badge-closed-text)" }}>
                          {closed ? "✓ Closed" : ev.closeDate}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => { setSelEvent(ev.id); setSelProgram(""); setBracketState(null); setSeeds([]); }}
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
        </div>
      )}

      {selEvent && (
        <>
          {/* ── Back + Event header ── */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6 print:hidden">
            <div>
              <button onClick={() => { setSelEvent(""); setSelProgram(""); setBracketState(null); setSeeds([]); }}
                className="btn-back flex items-center gap-1.5 text-xs px-3 py-1.5 mb-3">
                ← Back to Events
              </button>
              <h2 className="font-bold text-lg">{selEventObj?.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-1 font-semibold"
                  style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
                  {mode === "internal" ? "Internal Bracket" : "External (TournamentSoftware)"}
                </span>
                <span className="text-xs opacity-50">{selEventObj?.sportType}</span>
              </div>
            </div>

            {/* Program selector */}
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Program</label>
              <select className="field-input w-52" value={selProgram}
                onChange={e => {
                  const pid = e.target.value;
                  setSelProgram(pid);
                  setBracketState(null);
                  setActiveTab("");
                  // Load participants from config
                  const prog = selEventObj?.programs.find(p => p.id === pid);
                  setSeeds((prog as any)?.participantSeeds ?? []);
                }}>
                <option value="">Select program…</option>
                {selEventObj?.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {selProgram && (
                <span className="block text-xs mt-1.5 px-2 py-1 font-semibold w-fit"
                  style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                  {SCORING_RULES[scoringRule]?.label ?? scoringRule}
                </span>
              )}
            </div>
          </div>

          {!selProgram && (
            <div className="text-center py-16 opacity-40 text-sm">Select a program to manage fixtures.</div>
          )}

          {selProgram && (
            <>
              {/* ══ EXTERNAL MODE ══ */}
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
                      seeds={seeds}
                      maxSeeds={maxSeeds}
                      showAutoAssign={true}
                      seedError={seedError}
                      onAutoAssign={autoAssignSeeding}
                      onUpdateSeed={updateSeed}
                      onClearSeed={clearSeed}
                    />
                  </StepCard>
                  <StepCard n={3} title="Export Participant List to TournamentSoftware">
                    <button className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                      <Download className="h-4 w-4" /> Export Participant List with Seeding
                    </button>
                  </StepCard>
                </div>
              )}

              {/* ══ INTERNAL MODE ══ */}
              {mode === "internal" && (
                <div className="space-y-6">

                  {/* ── Locked banner ── */}
                  {locked && (
                    <div className="flex items-center gap-3 px-5 py-3"
                      style={{ backgroundColor: "var(--badge-soon-bg)", border: "1px solid var(--color-table-border)" }}>
                      <Lock className="h-4 w-4 flex-shrink-0" style={{ color: "var(--badge-soon-text)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--badge-soon-text)" }}>
                        Bracket locked — competition in progress. Draw cannot be changed.
                      </span>
                    </div>
                  )}

                  {/* ── Pre-generation state ── */}
                  {!bracketState && (
                    <>
                      {/* Pre-flight */}
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

                      {/* Seeding — hide for round_robin / league (seeding has no effect on draw order) */}
                      {!["round_robin", "league"].includes(format) && (
                        <SeedingTable
                          seeds={seeds}
                          maxSeeds={maxSeeds}
                          showAutoAssign={false}
                          seedError={seedError}
                          onAutoAssign={autoAssignSeeding}
                          onUpdateSeed={updateSeed}
                          onClearSeed={clearSeed}
                        />
                      )}
                      {["round_robin", "league"].includes(format) && (
                        <p className="text-xs opacity-50 px-1">ℹ Seeding is not used for {format === "league" ? "league" : "round-robin"} draw — all participants are placed equally.</p>
                      )}

                      {/* Generate button */}
                      <div className="flex items-center gap-4">
                        <button onClick={handleGenerate} disabled={!canGenerate}
                          title={!canGenerate ? "Close registration and meet minimum participants first" : ""}
                          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                          Generate Bracket
                        </button>
                        {seedError && <p className="text-xs font-semibold" style={{ color: "var(--badge-closed-text)" }}>{seedError}</p>}
                      </div>
                    </>
                  )}

                  {/* ── Post-generation state ── */}
                  {bracketState && (
                    <>
                      {/* View mode tabs + print/reset */}
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

                      {/* ── Phase tabs (groups / sections / knockout) ── */}
                      {(allGroupIds.length > 0 || allSectionIds.length > 0) && (
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

                      {/* ── Group standings ── */}
                      {activeTab !== "knockout" && isGroupFormat && bracketState.groups.length > 0 && (
                        <GroupStandingsTable
                          group={bracketState.groups.find(g => g.id === activeTab) ?? bracketState.groups[0]}
                          scoringRule={scoringRule}
                        />
                      )}

                      {/* ── Advance phase buttons + match progress ── */}
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
                        {/* Match progress counter */}
                        {(activeTab === "knockout" || format === "knockout") && maxKoRound > 0 && (
                          <span className="text-xs px-3 py-1.5 font-semibold"
                            style={{ backgroundColor: koRoundDone ? "var(--badge-open-bg)" : "var(--badge-soon-bg)", color: koRoundDone ? "var(--badge-open-text)" : "var(--badge-soon-text)" }}>
                            Round {maxKoRound} — {koRoundDone ? "All matches complete ✓" : `${completedInRound} / ${currKoRound.length} matches done`}
                          </span>
                        )}
                      </div>

                      {viewMode === "table" && (
                        <MatchTable
                          matches={pagedMatches}
                          page={page}
                          totalPages={totalPages}
                          perPage={perPage}
                          total={tabMatches.length}
                          onSetPage={setPage}
                          onSetPerPage={n => { setPerPage(n); setPage(1); }}
                          onOpenScore={openScore}
                          onToggleExpand={toggleExpand}
                        />
                      )}

                      {viewMode === "bracket" && (
                        <BracketView
                          matches={activeTab === "knockout" || format === "knockout"
                            ? bracketState.matches
                            : bracketState.groups.find(g => g.id === activeTab)?.matches
                              ?? bracketState.sections.find(s => s.id === activeTab)?.matches
                              ?? []}
                        />
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
      <Dialog open={!!scoreModal} onOpenChange={v => { if (!v) { setScoreModal(null); setDraft(null); } }}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0"
          style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-bold text-xl">
              {locked ? "Edit Score" : "Enter Score"} — {scoreModal?.id}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="p-8 pt-4 space-y-6">
              {/* Teams */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 p-4"
                style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <TeamPanel team={draft.team1} isWinner={draft.winner === "team1"} />
                <div className="flex items-center px-2"><span className="opacity-30 font-bold text-lg">vs</span></div>
                <TeamPanel team={draft.team2} isWinner={draft.winner === "team2"} />
              </div>

              {/* Walkover */}
              <div className="flex items-center justify-between gap-3 p-4" style={{ border: "1px solid var(--color-table-border)" }}>
                <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                  <AlertTriangle className="h-4 w-4 opacity-50 flex-shrink-0" />
                  Walkover — one side did not compete
                </label>
                <Switch checked={draft.walkover}
                  onCheckedChange={v => setDraft({ ...draft, walkover: v, walkoverWinner: "" })} />
              </div>

              {draft.walkover ? (
                <div>
                  <label className="block text-xs font-semibold mb-2 opacity-70">Walkover Winner *</label>
                  <select className="field-input" value={draft.walkoverWinner}
                    onChange={e => setDraft({ ...draft, walkoverWinner: e.target.value as "team1" | "team2" | "" })}>
                    <option value="">Select winner…</option>
                    <option value="team1">{draft.team1.label}</option>
                    <option value="team2">{draft.team2.label}</option>
                  </select>
                </div>
              ) : (
                <>
                  {/* Scores */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wide opacity-50">
                        {SCORING_RULES[scoringRule]?.setLabel ?? "Game"} Scores
                      </p>
                      <button onClick={addGame} className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: "var(--color-primary)" }}>
                        <Plus className="h-3 w-3" /> Add {SCORING_RULES[scoringRule]?.setLabel ?? "Game"}
                      </button>
                    </div>
                    <div className="grid grid-cols-[72px_1fr_28px_1fr_32px] gap-2 mb-2 px-1">
                      <span></span>
                      <span className="text-xs font-semibold opacity-60 truncate">{draft.team1.label}</span>
                      <span></span>
                      <span className="text-xs font-semibold opacity-60 truncate">{draft.team2.label}</span>
                      <span></span>
                    </div>
                    {draft.games.map((g, idx) => {
                      const p1w = g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2;
                      const p2w = g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1;
                      return (
                        <div key={idx} className="grid grid-cols-[72px_1fr_28px_1fr_32px] gap-2 mb-2 items-center">
                          <span className="text-xs opacity-50">{SCORING_RULES[scoringRule]?.setLabel ?? "Game"} {idx + 1}</span>
                          <input type="number" min="0" className="field-input text-center font-bold"
                            style={{ color: p1w ? "var(--color-primary)" : undefined }}
                            value={g.p1} placeholder="0" onChange={e => updateGame(idx, "p1", e.target.value)} />
                          <span className="text-center opacity-30 font-bold">–</span>
                          <input type="number" min="0" className="field-input text-center font-bold"
                            style={{ color: p2w ? "var(--color-primary)" : undefined }}
                            value={g.p2} placeholder="0" onChange={e => updateGame(idx, "p2", e.target.value)} />
                          <button onClick={() => removeGame(idx)} disabled={draft.games.length <= 1}
                            className="p-1 opacity-40 hover:opacity-80 disabled:opacity-10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {draft.games.some(g => g.p1 !== "" || g.p2 !== "") && (
                      <div className="flex gap-3 mt-3 pt-3 text-sm font-bold"
                        style={{ borderTop: "1px solid var(--color-table-border)" }}>
                        <span className="opacity-40 font-normal text-xs">Games won:</span>
                        <span style={{ color: "var(--color-primary)" }}>
                          {draft.team1.label.split(" ")[0]}: {draft.games.filter(g => g.p1 !== "" && +g.p1 > +g.p2).length}
                        </span>
                        <span className="opacity-20">·</span>
                        <span style={{ color: "var(--color-primary)" }}>
                          {draft.team2.label.split(" ")[0]}: {draft.games.filter(g => g.p2 !== "" && +g.p2 > +g.p1).length}
                        </span>
                      </div>
                    )}
                    <div className="mt-4">
                      <label className="block text-xs font-semibold mb-2 opacity-70">
                        Winner <span className="font-normal opacity-60">(auto-calculated · override if needed)</span>
                      </label>
                      <select className="field-input" value={draft.winner ?? ""}
                        onChange={e => setDraft({ ...draft, winner: (e.target.value || null) as "team1" | "team2" | null })}>
                        <option value="">Auto</option>
                        <option value="team1">{draft.team1.label}</option>
                        <option value="team2">{draft.team2.label}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-2 opacity-70">Start Time</label>
                  <input type="time" className="field-input" value={draft.startTime}
                    onChange={e => setDraft({ ...draft, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 opacity-70">End Time</label>
                  <input type="time" className="field-input" value={draft.endTime}
                    onChange={e => setDraft({ ...draft, endTime: e.target.value })} />
                </div>
              </div>

              {/* Officials */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide opacity-50">Officials</p>
                  <button onClick={addOfficial} className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: "var(--color-primary)" }}>
                    <Plus className="h-3 w-3" /> Add Official
                  </button>
                </div>
                {draft.officials.length === 0 && (
                  <p className="text-xs opacity-40">No officials assigned yet.</p>
                )}
                {draft.officials.map((o, idx) => (
                  <div key={o.id} className="flex gap-2 mb-2 items-center">
                    <div className="w-40 flex-shrink-0">
                      <input className="field-input" list={`roles-${idx}`} placeholder="Role"
                        value={o.role} onChange={e => updateOfficial(idx, "role", e.target.value)} />
                      <datalist id={`roles-${idx}`}>
                        {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
                      </datalist>
                    </div>
                    <input className="field-input flex-1" placeholder="Full name"
                      value={o.name} onChange={e => updateOfficial(idx, "name", e.target.value)} />
                    <button onClick={() => removeOfficial(idx)} className="p-1.5 opacity-40 hover:opacity-80">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => { setScoreModal(null); setDraft(null); }}
              className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={saveScore} className="btn-primary px-5 py-2.5 text-sm font-semibold">Save Score</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

// ── Seeding table ─────────────────────────────────────────────────────────────
function SeedingTable({ seeds, maxSeeds, showAutoAssign, seedError, onAutoAssign, onUpdateSeed, onClearSeed }: {
  seeds: SeedEntry[];
  maxSeeds: number;
  showAutoAssign: boolean;
  seedError: string | null;
  onAutoAssign: () => void;
  onUpdateSeed: (id: string, val: string) => void;
  onClearSeed: (id: string) => void;
}) {
  const seededCount = seeds.filter(s => s.seed !== null).length;
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-base">Participant Seeding</h3>
          {maxSeeds > 0 && (
            <span className="text-xs px-2 py-1 font-semibold"
              style={{
                backgroundColor: seededCount > maxSeeds ? "var(--badge-closed-bg)" : "var(--badge-soon-bg)",
                color: seededCount > maxSeeds ? "var(--badge-closed-text)" : "var(--badge-soon-text)",
              }}>
              {seededCount} / {maxSeeds} seeded
            </span>
          )}
        </div>
        {showAutoAssign && (
          <button onClick={onAutoAssign}
            className="btn-outline flex items-center gap-2 px-4 py-2 text-xs font-medium">
            <CheckCircle className="h-3.5 w-3.5" /> Auto-Assign from SBA
          </button>
        )}
      </div>
      {seedError && (
        <p className="text-xs font-semibold mb-3 px-3 py-2"
          style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)", border: "1px solid var(--badge-closed-text)" }}>
          ⚠ {seedError}
        </p>
      )}
      <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="trs-table">
          <thead>
            <tr>
              <th>Club / School / Company</th>
              <th>Participants</th>
              <th style={{ width: 130 }}>Seeding</th>
            </tr>
          </thead>
          <tbody>
            {seeds.map(s => {
              const isDup = s.seed !== null && seeds.filter(x => x.seed === s.seed).length > 1;
              return (
                <tr key={s.id} style={isDup ? { backgroundColor: "var(--badge-closed-bg)" } : undefined}>
                  <td className="font-medium text-sm">{s.club}</td>
                  <td className="text-sm opacity-70">{s.participants.join(" / ")}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min="1" className="field-input w-16 py-1 text-sm text-center"
                        value={s.seed ?? ""} placeholder="—"
                        style={isDup ? { borderColor: "var(--badge-closed-text)" } : undefined}
                        onChange={e => onUpdateSeed(s.id, e.target.value)} />
                      {s.seed !== null && (
                        <button onClick={() => onClearSeed(s.id)}
                          className="p-1 opacity-40 hover:opacity-100 transition-opacity"
                          title="Remove seeding">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Group standings ───────────────────────────────────────────────────────────
function GroupStandingsTable({ group, scoringRule }: { group: GroupEntry; scoringRule: string }) {
  const standings = computeGroupStandings(group, scoringRule as never);
  if (standings.every(s => s.played === 0)) return null;
  return (
    <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-50 px-4 py-3 border-b"
        style={{ borderColor: "var(--color-table-border)" }}>
        {group.name} — Standings
      </p>
      <table className="trs-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th>
            <th>GF</th><th>GA</th><th>PF</th><th>PA</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map(s => (
            <tr key={s.team.id}>
              <td className="text-sm font-bold" style={{ color: s.rank <= 2 ? "var(--color-primary)" : undefined }}>
                {s.rank}
              </td>
              <td>
                <p className="font-medium text-sm">{s.team.label}</p>
                <p className="text-xs opacity-60">{s.team.participants.join(" / ")}</p>
              </td>
              <td className="text-sm">{s.played}</td>
              <td className="text-sm font-semibold" style={{ color: "var(--badge-open-text)" }}>{s.wins}</td>
              <td className="text-sm">{s.losses}</td>
              <td className="text-sm">{s.gamesFor}</td>
              <td className="text-sm">{s.gamesAgainst}</td>
              <td className="text-sm">{s.pointsFor}</td>
              <td className="text-sm">{s.pointsAgainst}</td>
              <td className="text-sm font-bold">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Match table ───────────────────────────────────────────────────────────────
function MatchTable({ matches, page, totalPages, perPage, total, onSetPage, onSetPerPage, onOpenScore, onToggleExpand }: {
  matches: MatchEntry[];
  page: number; totalPages: number; perPage: number; total: number;
  onSetPage: (n: number) => void;
  onSetPerPage: (n: number) => void;
  onOpenScore: (m: MatchEntry) => void;
  onToggleExpand: (id: string) => void;
}) {
  const ssBadge = (s: MatchEntry["status"]) => {
    if (s === "Completed" || s === "Walkover") return { bg: "var(--badge-open-bg)",   text: "var(--badge-open-text)" };
    if (s === "In Progress")                   return { bg: "var(--badge-soon-bg)",   text: "var(--badge-soon-text)" };
    return                                            { bg: "var(--badge-closed-bg)", text: "var(--badge-closed-text)" };
  };

  if (matches.length === 0) {
    return <p className="text-sm opacity-40 py-8 text-center">No matches in this view yet.</p>;
  }

  return (
    <div style={{ border: "1px solid var(--color-table-border)" }}>
      <div className="overflow-x-auto">
        <table className="trs-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>Match</th>
              <th>Round</th>
              <th>Team 1</th>
              <th style={{ width: 36 }} className="text-center">vs</th>
              <th>Team 2</th>
              <th>Score</th>
              <th>Time</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(match => {
              const ss = ssBadge(match.status);
              const scoreStr = match.walkover
                ? `W/O → ${match.walkoverWinner === "team1" ? match.team1.label : match.team2.label}`
                : match.games.every(g => g.p1 !== "" && g.p2 !== "")
                  ? match.games.map(g => `${g.p1}–${g.p2}`).join(", ")
                  : "—";
              const isDone = match.status === "Completed" || match.status === "Walkover";

              return (
                <>
                  <tr key={match.id}>
                    <td>
                      <button onClick={() => onToggleExpand(match.id)} className="p-1 opacity-40 hover:opacity-100">
                        {match.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                    <td>
                      <div className="font-mono text-xs">{match.id}</div>
                      <div className="text-xs opacity-50">{match.roundLabel}</div>
                    </td>
                    <td className="text-sm font-medium">
                      {match.groupId ? `Grp ${match.groupId}` : match.sectionId ? `Sec ${match.sectionId}` : `R${match.round}`}
                    </td>
                    <td><TeamCell team={match.team1} isWinner={match.winner === "team1"} /></td>
                    <td className="text-center opacity-30 font-bold text-sm">vs</td>
                    <td><TeamCell team={match.team2} isWinner={match.winner === "team2"} /></td>
                    <td className="font-mono text-xs whitespace-nowrap">{scoreStr}</td>
                    <td className="text-xs opacity-70 whitespace-nowrap">
                      {match.startTime ? `${match.startTime}${match.endTime ? ` – ${match.endTime}` : ""}` : "—"}
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                        style={{ backgroundColor: ss.bg, color: ss.text }}>{match.status}</span>
                    </td>
                    <td>
                      <button onClick={() => onOpenScore(match)}
                        className="btn-primary px-3 py-1.5 text-xs font-semibold whitespace-nowrap">
                        {isDone ? "Edit Score" : "Enter Score"}
                      </button>
                    </td>
                  </tr>
                  {match.expanded && (
                    <tr key={`${match.id}-x`}>
                      <td colSpan={10} className="p-0">
                        <div className="px-8 py-5 grid sm:grid-cols-3 gap-6"
                          style={{ backgroundColor: "var(--color-row-hover)", borderTop: "1px solid var(--color-table-border)" }}>
                          {/* Score breakdown */}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-3 opacity-50">Score Breakdown</p>
                            {match.walkover ? (
                              <p className="text-sm font-medium">W/O → {match.walkoverWinner === "team1" ? match.team1.label : match.team2.label}</p>
                            ) : match.games.some(g => g.p1 !== "") ? (
                              <div className="space-y-1">
                                <div className="grid grid-cols-[48px_1fr_16px_1fr] gap-2 text-xs opacity-50 mb-2">
                                  <span></span>
                                  <span className="truncate">{match.team1.label}</span>
                                  <span></span>
                                  <span className="truncate">{match.team2.label}</span>
                                </div>
                                {match.games.map((g, i) => {
                                  const p1w = g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2;
                                  const p2w = g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1;
                                  return (
                                    <div key={i} className="grid grid-cols-[48px_1fr_16px_1fr] gap-2 text-sm items-center">
                                      <span className="text-xs opacity-40">G{i + 1}</span>
                                      <span className="font-bold" style={{ color: p1w ? "var(--color-primary)" : undefined }}>{g.p1 || "—"}</span>
                                      <span className="opacity-20 text-center">–</span>
                                      <span className="font-bold" style={{ color: p2w ? "var(--color-primary)" : undefined }}>{g.p2 || "—"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : <p className="text-xs opacity-40">No scores yet.</p>}
                          </div>
                          {/* Participants */}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-3 opacity-50">Participants</p>
                            {[match.team1, match.team2].map((team, ti) => (
                              <div key={ti} className="mb-3">
                                <p className="text-xs font-semibold mb-1">{team.label}</p>
                                {team.participants.map((p, pi) => (
                                  <p key={pi} className="text-xs opacity-60">{pi + 1}. {p}</p>
                                ))}
                              </div>
                            ))}
                          </div>
                          {/* Officials */}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-3 opacity-50">Officials</p>
                            {match.officials.length > 0
                              ? match.officials.map(o => (
                                  <div key={o.id} className="flex gap-2 text-xs mb-1">
                                    <span className="opacity-50 w-20 flex-shrink-0">{o.role}</span>
                                    <span>{o.name}</span>
                                  </div>
                                ))
                              : <p className="text-xs opacity-40">None assigned.</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} perPage={perPage} total={total}
        setPage={onSetPage} setPerPage={onSetPerPage} />
    </div>
  );
}

// ── Bracket (visual tree) view ────────────────────────────────────────────────
function BracketView({ matches }: { matches: MatchEntry[] }) {
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  if (rounds.length === 0) {
    return <p className="text-sm opacity-40 py-8 text-center">No knockout matches yet.</p>;
  }
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-0 min-w-max">
        {rounds.map((round, ri) => {
          const roundMatches = matches.filter(m => m.round === round);
          // Spacing: each round doubles the gap between matches
          const spacerH = Math.pow(2, ri) * 20;
          return (
            <div key={round} className="flex flex-col" style={{ width: 220, marginRight: ri < rounds.length - 1 ? 0 : 0 }}>
              <div className="text-xs font-bold uppercase tracking-wide opacity-50 px-3 py-2 text-center"
                style={{ borderBottom: "1px solid var(--color-table-border)" }}>
                {roundMatches[0]?.roundLabel ?? `Round ${round}`}
              </div>
              <div className="flex flex-col" style={{ paddingTop: spacerH / 2 }}>
                {roundMatches.map((match, mi) => {
                  const isDone = match.status === "Completed" || match.status === "Walkover";
                  return (
                    <div key={match.id}
                      className="mx-3 mb-0"
                      style={{ marginBottom: mi < roundMatches.length - 1 ? spacerH : 0 }}>
                      {/* Team 1 */}
                      <BracketTeamSlot team={match.team1} isWinner={match.winner === "team1"} isDone={isDone} />
                      {/* Divider */}
                      <div style={{ height: 1, backgroundColor: "var(--color-table-border)" }} />
                      {/* Team 2 */}
                      <BracketTeamSlot team={match.team2} isWinner={match.winner === "team2"} isDone={isDone} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketTeamSlot({ team, isWinner, isDone }: { team: TeamEntry; isWinner: boolean; isDone: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2"
      style={{
        backgroundColor: isWinner ? "var(--color-primary)" : "var(--color-page-bg)",
        border: "1px solid var(--color-table-border)",
        borderBottom: "none",
        minHeight: 44,
      }}>
      {team.seed !== undefined && (
        <span className="text-xs font-bold flex-shrink-0 opacity-60"
          style={{ color: isWinner ? "var(--color-hero-text)" : undefined }}>
          #{team.seed}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate"
          style={{ color: isWinner ? "var(--color-hero-text)" : "var(--color-body-text)" }}>
          {team.label}
        </div>
        {team.participants.slice(0, 1).map((p, i) => (
          <div key={i} className="text-xs truncate"
            style={{ color: isWinner ? "var(--color-hero-text)" : "var(--color-body-text)", opacity: 0.7 }}>
            {p}
          </div>
        ))}
      </div>
      {isWinner && isDone && (
        <Trophy className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-hero-text)" }} />
      )}
    </div>
  );
}

// ── Print view (hidden on screen, shows on @media print) ─────────────────────
function PrintView({ eventName, programName, bracketState }: {
  eventName: string;
  programName: string;
  bracketState: BracketState;
}) {
  const allMatches = [
    ...bracketState.groups.flatMap(g => g.matches),
    ...bracketState.sections.flatMap(s => s.matches),
    ...bracketState.matches,
  ];

  return (
    <div className="hidden print:block print:mt-0">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">{eventName}</h1>
        <h2 className="text-lg">{programName} — Fixture Schedule</h2>
        <p className="text-sm opacity-60">Printed: {new Date().toLocaleString("en-SG")}</p>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ backgroundColor: "#1E3A5F", color: "white" }}>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Match</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Round</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Team 1</th>
            <th style={{ padding: "6px 8px", textAlign: "center" }}>Score</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Team 2</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Time</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {allMatches.map((match, i) => {
            const scoreStr = match.walkover
              ? `W/O`
              : match.games.every(g => g.p1 !== "" && g.p2 !== "")
                ? match.games.map(g => `${g.p1}–${g.p2}`).join(", ")
                : "—";
            return (
              <tr key={match.id} style={{ backgroundColor: i % 2 === 0 ? "white" : "#F3F4F6" }}>
                <td style={{ padding: "5px 8px", fontFamily: "monospace" }}>{match.id}</td>
                <td style={{ padding: "5px 8px" }}>{match.roundLabel}</td>
                <td style={{ padding: "5px 8px", fontWeight: match.winner === "team1" ? "bold" : undefined }}>
                  {match.team1.label}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace" }}>{scoreStr}</td>
                <td style={{ padding: "5px 8px", fontWeight: match.winner === "team2" ? "bold" : undefined }}>
                  {match.team2.label}
                </td>
                <td style={{ padding: "5px 8px" }}>
                  {match.startTime ? `${match.startTime}${match.endTime ? ` – ${match.endTime}` : ""}` : "—"}
                </td>
                <td style={{ padding: "5px 8px" }}>{match.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-5 py-2.5 text-sm font-semibold whitespace-nowrap flex-shrink-0"
      style={{
        borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent",
        color: active ? "var(--color-primary)" : "var(--color-body-text)",
        marginBottom: "-2px",
      }}>
      {children}
    </button>
  );
}

function StepCard({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="p-6" style={{ border: "1px solid var(--color-table-border)" }}>
      <div className="flex items-start gap-4 mb-5">
        <div className="w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-hero-text)" }}>{n}</div>
        <div>
          <p className="font-bold text-sm">{title}</p>
          {description && <p className="text-xs opacity-60 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok
        ? <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "var(--badge-open-text)" }} />
        : <Lock        className="h-4 w-4 flex-shrink-0" style={{ color: "var(--badge-closed-text)" }} />}
      <span style={{ color: ok ? "var(--color-body-text)" : "var(--badge-closed-text)" }}>{label}</span>
    </div>
  );
}

function TeamCell({ team, isWinner }: { team: TeamEntry; isWinner: boolean }) {
  const [open, setOpen] = useState(false);
  const shown = open ? team.participants : team.participants.slice(0, 2);
  return (
    <div className="text-sm min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        {team.seed !== undefined && (
          <span className="text-xs font-bold px-1.5 py-0.5 flex-shrink-0"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-hero-text)" }}>
            #{team.seed}
          </span>
        )}
        <span className="font-semibold truncate max-w-[130px]" title={team.label}>{team.label}</span>
        {isWinner && <Trophy className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />}
      </div>
      {shown.map((p, i) => <div key={i} className="text-xs opacity-60 truncate">{p}</div>)}
      {team.participants.length > 2 && (
        <button onClick={() => setOpen(!open)} className="text-xs font-medium flex items-center gap-0.5 mt-0.5"
          style={{ color: "var(--color-primary)" }}>
          <Users className="h-3 w-3" />
          {open ? "Show less" : `+${team.participants.length - 2} more`}
        </button>
      )}
    </div>
  );
}

function TeamPanel({ team, isWinner }: { team: TeamEntry; isWinner: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        {team.seed !== undefined && (
          <span className="text-xs font-bold px-1.5 py-0.5"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-hero-text)" }}>
            #{team.seed}
          </span>
        )}
        {isWinner && <Trophy className="h-4 w-4" style={{ color: "var(--color-primary)" }} />}
      </div>
      <p className="font-bold text-sm">{team.label}</p>
      {team.participants.map((p, i) => <p key={i} className="text-xs opacity-60">{p}</p>)}
    </div>
  );
}