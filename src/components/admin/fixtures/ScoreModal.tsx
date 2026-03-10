import React from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { MatchEntry, Official } from "@/types/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SCORING_RULES } from "@/lib/fixtureEngine";
import { TeamPanel } from "./shared";

const ROLE_SUGGESTIONS = ["Referee", "Linesman", "Umpire", "Court Marshal", "Scorer", "Ball Boy"];

function genId() { return Math.random().toString(36).slice(2, 8); }

interface Props {
  open: boolean;
  draft: MatchEntry | null;
  scoringRule: string;
  isLocked: boolean;
  onClose: () => void;
  onSave: () => void;
  onChangeDraft: (d: MatchEntry) => void;
}

export function ScoreModal({
  open, draft, scoringRule, isLocked, onClose, onSave, onChangeDraft,
}: Props) {
  if (!draft) return null;

  const updateGame = (idx: number, side: "p1" | "p2", val: string) =>
    onChangeDraft({ ...draft, games: draft.games.map((g, i) => i === idx ? { ...g, [side]: val } : g) });

  const addGame = () =>
    onChangeDraft({ ...draft, games: [...draft.games, { p1: "", p2: "" }] });

  const removeGame = (idx: number) => {
    if (draft.games.length <= 1) return;
    onChangeDraft({ ...draft, games: draft.games.filter((_, i) => i !== idx) });
  };

  const addOfficial = () =>
    onChangeDraft({ ...draft, officials: [...draft.officials, { id: genId(), role: "", name: "" }] });

  const updateOfficial = (idx: number, k: keyof Official, v: string) =>
    onChangeDraft({ ...draft, officials: draft.officials.map((o, i) => i === idx ? { ...o, [k]: v } : o) });

  const removeOfficial = (idx: number) =>
    onChangeDraft({ ...draft, officials: draft.officials.filter((_, i) => i !== idx) });

  const setLabel = SCORING_RULES[scoringRule]?.setLabel ?? "Game";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-xl max-h-[92vh] overflow-y-auto p-0"
        style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}
      >
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="font-bold text-xl">
            {isLocked ? "Edit Score" : "Enter Score"} — {draft.id}
          </DialogTitle>
        </DialogHeader>

        <div className="p-8 pt-4 space-y-6">
          {/* Teams header */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 p-4"
            style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <TeamPanel team={draft.team1} isWinner={draft.winner === "team1"} />
            <div className="flex items-center px-2">
              <span className="opacity-30 font-bold text-lg">vs</span>
            </div>
            <TeamPanel team={draft.team2} isWinner={draft.winner === "team2"} />
          </div>

          {/* Walkover toggle */}
          <div className="flex items-center justify-between gap-3 p-4"
            style={{ border: "1px solid var(--color-table-border)" }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
              <AlertTriangle className="h-4 w-4 opacity-50 flex-shrink-0" />
              Walkover — one side did not compete
            </label>
            <Switch
              checked={draft.walkover}
              onCheckedChange={v => onChangeDraft({ ...draft, walkover: v, walkoverWinner: "" })}
            />
          </div>

          {draft.walkover ? (
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Walkover Winner *</label>
              <select className="field-input" value={draft.walkoverWinner}
                onChange={e => onChangeDraft({ ...draft, walkoverWinner: e.target.value as "team1" | "team2" | "" })}>
                <option value="">Select winner…</option>
                <option value="team1">{draft.team1.label}</option>
                <option value="team2">{draft.team2.label}</option>
              </select>
            </div>
          ) : (
            <>
              {/* Game scores */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wide opacity-50">{setLabel} Scores</p>
                  <button onClick={addGame} className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: "var(--color-primary)" }}>
                    <Plus className="h-3 w-3" /> Add {setLabel}
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
                      <span className="text-xs opacity-50">{setLabel} {idx + 1}</span>
                      <input type="number" min="0" className="field-input text-center font-bold"
                        style={{ color: p1w ? "var(--color-primary)" : undefined }}
                        value={g.p1} placeholder="0"
                        onChange={e => updateGame(idx, "p1", e.target.value)} />
                      <span className="text-center opacity-30 font-bold">–</span>
                      <input type="number" min="0" className="field-input text-center font-bold"
                        style={{ color: p2w ? "var(--color-primary)" : undefined }}
                        value={g.p2} placeholder="0"
                        onChange={e => updateGame(idx, "p2", e.target.value)} />
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
                    onChange={e => onChangeDraft({ ...draft, winner: (e.target.value || null) as "team1" | "team2" | null })}>
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
                onChange={e => onChangeDraft({ ...draft, startTime: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">End Time</label>
              <input type="time" className="field-input" value={draft.endTime}
                onChange={e => onChangeDraft({ ...draft, endTime: e.target.value })} />
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

        <DialogFooter className="p-8 pt-0">
          <button onClick={onClose} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
          <button onClick={onSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">Save Score</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}