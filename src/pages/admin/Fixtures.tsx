import { useState, useMemo } from "react";
import { Download, Upload, Plus, Trash2, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Users, CheckCircle, Lock } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/TableControls";

// ── Types ────────────────────────────────────────────────────────────────────
type MatchStatus = "Scheduled" | "In Progress" | "Completed" | "Walkover";

interface GameScore { p1: string; p2: string; }
interface Official  { id: string; role: string; name: string; }

interface TeamEntry {
  label: string;      // club / school / company
  participants: string[];
  seed?: number;
}

interface MatchEntry {
  id: string;
  round: number;
  team1: TeamEntry;
  team2: TeamEntry;
  games: GameScore[];
  winner: "team1" | "team2" | null;
  walkover: boolean;
  walkoverWinner: "team1" | "team2" | "";
  startTime: string;
  endTime: string;
  officials: Official[];
  status: MatchStatus;
  expanded: boolean;
}

const ROLE_SUGGESTIONS = ["Referee", "Linesman", "Umpire", "Court Marshal", "Scorer", "Ball Boy"];

// ── Sample SBA master list ───────────────────────────────────────────────────
const SBA_MASTER = [
  { sbaId: "SBA-001", name: "Lee Wei Jie",   club: "Pasir Ris BC",  ranking: 1 },
  { sbaId: "SBA-002", name: "Tan Mei Ling",  club: "Tampines BC",   ranking: 2 },
  { sbaId: "SBA-003", name: "Ravi Kumar",    club: "Jurong BC",     ranking: 3 },
  { sbaId: "SBA-004", name: "Wong Xiu Ying", club: "Bishan SC",     ranking: 4 },
];

// ── Sample participant seeding list ─────────────────────────────────────────
interface SeedEntry { id: string; club: string; participants: string[]; seed: number | null; }

const SAMPLE_SEEDS: SeedEntry[] = [
  { id: "s1", club: "Pasir Ris BC",  participants: ["Lee Wei Jie"],                   seed: 1 },
  { id: "s2", club: "Tampines BC",   participants: ["Tan Ah Kow"],                    seed: null },
  { id: "s3", club: "Jurong BC",     participants: ["Ravi Kumar"],                    seed: 2 },
  { id: "s4", club: "Bishan SC",     participants: ["Wong Beng Huat"],                seed: null },
  { id: "s5", club: "Serangoon BC",  participants: ["Ahmad Farid"],                   seed: 3 },
  { id: "s6", club: "Yishun BC",     participants: ["Lim Jun Wei"],                   seed: null },
  { id: "s7", club: "Tampines BC",   participants: ["Lee Wei Jie", "Tan Mei Ling"],   seed: null },
  { id: "s8", club: "Pasir Ris BC",  participants: ["Ravi Kumar",  "Wong Xiu Ying"], seed: null },
];

// ── Sample matches ────────────────────────────────────────────────────────────
const SAMPLE_MATCHES: MatchEntry[] = [
  {
    id: "M001", round: 1,
    team1: { label: "Pasir Ris BC",  participants: ["Lee Wei Jie"],              seed: 1 },
    team2: { label: "Tampines BC",   participants: ["Tan Ah Kow"],               seed: undefined },
    games: [{ p1: "21", p2: "15" }, { p1: "18", p2: "21" }, { p1: "21", p2: "18" }],
    winner: "team1", walkover: false, walkoverWinner: "",
    startTime: "09:00", endTime: "09:42",
    officials: [{ id: "o1", role: "Referee", name: "Ahmad Bin Ismail" }],
    status: "Completed", expanded: false,
  },
  {
    id: "M002", round: 1,
    team1: { label: "Jurong BC",     participants: ["Ravi Kumar"],               seed: 2 },
    team2: { label: "Bishan SC",     participants: ["Wong Beng Huat"],           seed: undefined },
    games: [{ p1: "", p2: "" }],
    winner: null, walkover: false, walkoverWinner: "",
    startTime: "", endTime: "", officials: [], status: "Scheduled", expanded: false,
  },
];

function genId() { return Math.random().toString(36).slice(2, 8); }

export default function AdminFixtures() {
  const events = config.events as TournamentEvent[];

  const [selEvent,   setSelEvent]   = useState("");
  const [selProgram, setSelProgram] = useState("");

  // Derive mode from event settings
  const selEventObj   = events.find(e => e.id === selEvent);
  const selProgramObj = selEventObj?.programs.find(p => p.id === selProgram);
  const mode          = selEventObj?.fixtureMode || "internal";
  const isBadminton   = selEventObj?.sportType === "Badminton";

  // ── External mode state ──
  const [seeds,    setSeeds]    = useState<SeedEntry[]>(SAMPLE_SEEDS);
  const [sbaFile,  setSbaFile]  = useState<string | null>(null);

  // ── Internal mode state ──
  const [matches,    setMatches]    = useState<MatchEntry[]>(SAMPLE_MATCHES);
  const [scoreModal, setScoreModal] = useState<MatchEntry | null>(null);
  const [draft,      setDraft]      = useState<MatchEntry | null>(null);
  const [page, setPage]         = useState(1);
  const [perPage, setPerPage]   = useState(10);

  // Round analysis
  const rounds    = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  const maxRound  = rounds.length > 0 ? Math.max(...rounds) : 0;
  const currentRoundMatches = matches.filter(m => m.round === maxRound);
  const currentRoundDone    = currentRoundMatches.length > 0 &&
    currentRoundMatches.every(m => m.status === "Completed" || m.status === "Walkover");
  const canGenerateNext = currentRoundDone;

  // Pagination
  const totalPages   = Math.max(1, Math.ceil(matches.length / perPage));
  const pagedMatches = matches.slice((page - 1) * perPage, page * perPage);

  // ── Participant requirement check ──
  const regClosed      = selEventObj ? new Date() > new Date(selEventObj.closeDate) : false;
  const minMet         = seeds.length >= (selProgramObj?.minParticipants || 0);
  const canGenerate    = regClosed && minMet;

  // ── Seeding helpers ──
  const autoAssignSeeding = () => {
    setSeeds(prev => prev.map(entry => {
      const match = SBA_MASTER.find(s =>
        entry.participants.some(p => p.toLowerCase().includes(s.name.toLowerCase()))
      );
      return match ? { ...entry, seed: match.ranking } : entry;
    }));
  };

  const updateSeed = (id: string, val: string) =>
    setSeeds(prev => prev.map(s => s.id === id ? { ...s, seed: val ? +val : null } : s));

  // ── Internal mode helpers ──
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
    if (!draft) return;
    const p1g = draft.games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2).length;
    const p2g = draft.games.filter(g => g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1).length;
    let winner: "team1" | "team2" | null = null;
    let status: MatchStatus = "In Progress";
    if (draft.walkover && draft.walkoverWinner) { winner = draft.walkoverWinner as "team1" | "team2"; status = "Walkover"; }
    else if (draft.winner)                      { winner = draft.winner; status = "Completed"; }
    else if (draft.games.every(g => g.p1 !== "" && g.p2 !== "")) {
      winner = p1g > p2g ? "team1" : "team2"; status = "Completed";
    }
    setMatches(prev => prev.map(m => m.id === scoreModal!.id ? { ...draft, winner, status } : m));
    setScoreModal(null); setDraft(null);
  };

  const generateNextRound = () => {
    const winners = currentRoundMatches.map(m =>
      m.winner === "team1" ? m.team1 : m.winner === "team2" ? m.team2 : null
    ).filter(Boolean) as TeamEntry[];
    const newRound = maxRound + 1;
    const newMatches: MatchEntry[] = [];
    for (let i = 0; i < winners.length - 1; i += 2) {
      newMatches.push({
        id: `M${String(matches.length + newMatches.length + 1).padStart(3, "0")}`,
        round: newRound,
        team1: winners[i], team2: winners[i + 1],
        games: [{ p1: "", p2: "" }], winner: null,
        walkover: false, walkoverWinner: "",
        startTime: "", endTime: "", officials: [],
        status: "Scheduled", expanded: false,
      });
    }
    setMatches(prev => [...prev, ...newMatches]);
  };

  const generateInitialBracket = () => {
    const seeded   = [...seeds].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    const newMatches: MatchEntry[] = [];
    for (let i = 0; i < seeded.length - 1; i += 2) {
      newMatches.push({
        id: `M${String(i / 2 + 1).padStart(3, "0")}`, round: 1,
        team1: { label: seeded[i].club,     participants: seeded[i].participants,     seed: seeded[i].seed     ?? undefined },
        team2: { label: seeded[i+1].club,   participants: seeded[i+1].participants,   seed: seeded[i+1].seed   ?? undefined },
        games: [{ p1: "", p2: "" }], winner: null,
        walkover: false, walkoverWinner: "",
        startTime: "", endTime: "", officials: [],
        status: "Scheduled", expanded: false,
      });
    }
    setMatches(newMatches);
  };

  const ssBadge = (s: MatchStatus) => {
    if (s === "Completed" || s === "Walkover") return { bg: "var(--badge-open-bg)",   text: "var(--badge-open-text)"   };
    if (s === "In Progress")                   return { bg: "var(--badge-soon-bg)",   text: "var(--badge-soon-text)"   };
    return                                            { bg: "var(--badge-closed-bg)", text: "var(--badge-closed-text)" };
  };

  return (
    <div>
      <h1 className="font-bold text-2xl mb-8">Fixture Management</h1>

      {/* Event + Program selectors */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div>
          <label className="block text-xs font-semibold mb-2 opacity-70">Event</label>
          <select className="field-input w-64" value={selEvent}
            onChange={e => { setSelEvent(e.target.value); setSelProgram(""); }}>
            <option value="">Select event…</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        {selEvent && (
          <div>
            <label className="block text-xs font-semibold mb-2 opacity-70">Program</label>
            <select className="field-input w-52" value={selProgram}
              onChange={e => setSelProgram(e.target.value)}>
              <option value="">Select program…</option>
              {selEventObj?.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        {selEvent && (
          <div className="flex items-end pb-1">
            <span className="text-xs px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
              Mode: {mode === "internal" ? "Internal Bracket" : "External (TournamentSoftware)"}
            </span>
          </div>
        )}
      </div>

      {!selEvent && (
        <div className="text-center py-16 opacity-40">Select an event to manage fixtures.</div>
      )}

      {selEvent && (
        <>
          {/* ══ EXTERNAL MODE ══ */}
          {mode === "external" && (
            <div className="space-y-8">

              {/* Step 1: Import SBA */}
              <StepCard n={1} title="Import SBA Player Ranking File"
                description="Upload the official SBA file to update the master ranking list.">
                <label className="inline-flex items-center gap-2 btn-outline px-5 py-2.5 text-sm font-medium cursor-pointer">
                  <Upload className="h-4 w-4" /> Import SBA File (.xlsx / .csv)
                  <input type="file" accept=".xlsx,.csv" className="hidden"
                    onChange={e => setSbaFile(e.target.files?.[0]?.name || null)} />
                </label>
                {sbaFile && <p className="text-xs mt-2 opacity-60">Loaded: {sbaFile}</p>}
              </StepCard>

              {/* Step 2: Assign seeding */}
              <StepCard n={2} title="Assign Seeding to Participants">
                <div className="flex gap-3 mb-5">
                  <button onClick={autoAssignSeeding}
                    className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                    <CheckCircle className="h-4 w-4" /> Auto-Assign from SBA Rankings
                  </button>
                  <span className="self-center text-xs opacity-40">or set manually below</span>
                </div>
                <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
                  <table className="trs-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Club / School / Company</th>
                        <th>Participants</th>
                        <th style={{ width: 100 }}>Seeding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seeds.map((s, i) => (
                        <tr key={s.id}>
                          <td className="text-sm opacity-50">{i + 1}</td>
                          <td className="font-medium text-sm">{s.club}</td>
                          <td className="text-sm opacity-70">{s.participants.join(" / ")}</td>
                          <td>
                            <input type="number" min="1" className="field-input w-16 py-1 text-sm text-center"
                              value={s.seed ?? ""} placeholder="—"
                              onChange={e => updateSeed(s.id, e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </StepCard>

              {/* Step 3: Export */}
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

              {/* Pre-flight check */}
              <div className="p-5 space-y-2" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <p className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Requirements to Generate Fixture</p>
                <CheckRow ok={regClosed} label={regClosed
                  ? "Registration is closed"
                  : `Registration still open (closes ${selEventObj?.closeDate})`} />
                <CheckRow ok={minMet} label={minMet
                  ? `Minimum participants met (${seeds.length} registered)`
                  : `Need at least ${selProgramObj?.minParticipants || "?"} participants (${seeds.length} registered)`} />
              </div>

              {/* Seeding assignment */}
              {selProgram && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-base">Participant Seeding</h3>
                    <button onClick={autoAssignSeeding}
                      disabled={!isBadminton}
                      title={isBadminton ? "Auto-assign from SBA" : "SBA auto-assign only available for Badminton"}
                      className="btn-outline flex items-center gap-2 px-4 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                      <CheckCircle className="h-3.5 w-3.5" /> Auto-Assign from SBA
                    </button>
                  </div>
                  <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
                    <table className="trs-table">
                      <thead>
                        <tr>
                          <th>Club / School / Company</th>
                          <th>Participants</th>
                          <th style={{ width: 100 }}>Seeding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seeds.map(s => (
                          <tr key={s.id}>
                            <td className="font-medium text-sm">{s.club}</td>
                            <td className="text-sm opacity-70">{s.participants.join(" / ")}</td>
                            <td>
                              <input type="number" min="1" className="field-input w-16 py-1 text-sm text-center"
                                value={s.seed ?? ""} placeholder="—"
                                onChange={e => updateSeed(s.id, e.target.value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Generate / next round */}
              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={generateInitialBracket} disabled={!canGenerate}
                  title={canGenerate ? "" : "Registration must be closed and min participants met"}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                  Generate Round 1 Bracket
                </button>
                {canGenerateNext && (
                  <button onClick={generateNextRound}
                    className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                    Generate Round {maxRound + 1} Bracket
                  </button>
                )}
                {maxRound > 0 && (
                  <span className="text-xs opacity-50">
                    Current round: {maxRound} ·{" "}
                    {currentRoundDone ? "All matches complete ✓" : `${currentRoundMatches.filter(m => m.status === "Completed" || m.status === "Walkover").length} / ${currentRoundMatches.length} done`}
                  </span>
                )}
              </div>

              {/* Round tabs */}
              {rounds.length > 0 && (
                <div className="flex gap-0"
                  style={{ borderBottom: "2px solid var(--color-table-border)" }}>
                  {rounds.map(r => (
                    <span key={r} className="px-5 py-2 text-sm font-semibold"
                      style={{
                        borderBottom: r === maxRound ? "2px solid var(--color-primary)" : "2px solid transparent",
                        color: r === maxRound ? "var(--color-primary)" : "var(--color-body-text)",
                        marginBottom: "-2px",
                      }}>
                      Round {r}
                      {r < maxRound && <CheckCircle className="h-3 w-3 inline ml-1" style={{ color: "var(--color-primary)" }} />}
                    </span>
                  ))}
                </div>
              )}

              {/* Match table */}
              {matches.length > 0 && (
                <div style={{ border: "1px solid var(--color-table-border)" }}>
                  <div className="overflow-x-auto">
                    <table className="trs-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}></th>
                          <th>Match</th>
                          <th>Round</th>
                          <th>Club / Participants</th>
                          <th style={{ width: 36 }} className="text-center">vs</th>
                          <th>Club / Participants</th>
                          <th>Score</th>
                          <th>Time</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedMatches.map(match => {
                          const ss = ssBadge(match.status);
                          const scoreStr = match.walkover
                            ? `W/O → ${match.walkoverWinner === "team1" ? match.team1.label : match.team2.label}`
                            : match.games.every(g => g.p1 !== "" && g.p2 !== "")
                              ? match.games.map(g => `${g.p1}–${g.p2}`).join(", ") : "—";
                          return (
                            <>
                              <tr key={match.id}>
                                <td>
                                  <button onClick={() => setMatches(p => p.map(m => m.id === match.id ? { ...m, expanded: !m.expanded } : m))}
                                    className="p-1 opacity-40 hover:opacity-100">
                                    {match.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                </td>
                                <td className="font-mono text-xs">{match.id}</td>
                                <td className="text-sm font-medium">R{match.round}</td>
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
                                  <button onClick={() => openScore(match)}
                                    disabled={match.status === "Completed" || match.status === "Walkover"}
                                    className="btn-primary px-3 py-1.5 text-xs font-semibold whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed">
                                    {match.status === "Completed" || match.status === "Walkover" ? "Done" : "Enter Score"}
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
                                              <span></span><span className="truncate">{match.team1.label}</span><span></span><span className="truncate">{match.team2.label}</span>
                                            </div>
                                            {match.games.map((g, i) => {
                                              const p1w = g.p1 !== "" && g.p2 !== "" && +g.p1 > +g.p2;
                                              const p2w = g.p1 !== "" && g.p2 !== "" && +g.p2 > +g.p1;
                                              return (
                                                <div key={i} className="grid grid-cols-[48px_1fr_16px_1fr] gap-2 text-sm items-center">
                                                  <span className="text-xs opacity-40">G{i+1}</span>
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
                  <Pagination page={page} totalPages={totalPages} perPage={perPage} total={matches.length}
                    setPage={setPage} setPerPage={n => { setPerPage(n); setPage(1); }} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ Score Entry Modal ══ */}
      <Dialog open={!!scoreModal} onOpenChange={v => { if (!v) { setScoreModal(null); setDraft(null); } }}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0"
          style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-bold text-xl">Score Entry — {scoreModal?.id}</DialogTitle>
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
              <div className="flex items-center gap-3 p-4" style={{ border: "1px solid var(--color-table-border)" }}>
                <AlertTriangle className="h-4 w-4 opacity-50 flex-shrink-0" />
                <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                  <input type="checkbox" checked={draft.walkover}
                    onChange={e => setDraft({ ...draft, walkover: e.target.checked, walkoverWinner: "" })} />
                  Walkover — one side did not compete
                </label>
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
                      <p className="text-xs font-bold uppercase tracking-wide opacity-50">Game Scores</p>
                      <button onClick={addGame} className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: "var(--color-primary)" }}>
                        <Plus className="h-3 w-3" /> Add Game
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
                          <span className="text-xs opacity-50">Game {idx + 1}</span>
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
                  <p className="text-xs opacity-40">No officials assigned yet. Type any role — suggestions provided.</p>
                )}
                {draft.officials.map((o, idx) => (
                  <div key={o.id} className="flex gap-2 mb-2 items-center">
                    <div className="w-40 flex-shrink-0">
                      <input className="field-input" list={`roles-${idx}`}
                        placeholder="Role (e.g. Referee)"
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

// ── Sub-components ─────────────────────────────────────────────────────────────
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
  const showToggle = team.participants.length > 2;
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
      {showToggle && (
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