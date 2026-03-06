import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Program, FixtureFormat, ScoringRuleId, FixtureFormatConfig, TiebreakCriteria } from "@/types/config";
import { SCORING_RULES } from "@/lib/fixtureEngine";

// ── Option lists ──────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text",   label: "Text" },
  { value: "number", label: "Number" },
  { value: "date",   label: "Date (Calendar)" },
  { value: "select", label: "Dropdown (Options)" },
];

const FIXTURE_FORMATS: { value: FixtureFormat; label: string; description: string }[] = [
  { value: "knockout",           label: "Knockout",             description: "Single-elimination bracket" },
  { value: "sectional_knockout", label: "Sectional Knockout",   description: "Divide into sections, each runs KO, winners meet" },
  { value: "group_knockout",     label: "Group + Knockout",     description: "Round-robin groups → top finishers in KO bracket" },
  { value: "round_robin",        label: "Round Robin",          description: "Everyone plays everyone, standings only" },
  { value: "league",             label: "League",               description: "Round-robin with home/away, full league table" },
  { value: "heats_final",        label: "Heats + Final",        description: "Qualifying heats → A/B/C finals" },
];

const SCORING_OPTIONS = Object.values(SCORING_RULES).map(r => ({ value: r.id, label: r.label }));

const TIEBREAK_OPTIONS: { value: TiebreakCriteria; label: string }[] = [
  { value: "head_to_head",    label: "Head-to-Head Result" },
  { value: "game_ratio",      label: "Game Ratio (won ÷ played)" },
  { value: "point_ratio",     label: "Point Ratio (for ÷ against)" },
  { value: "goal_difference", label: "Goal Difference" },
  { value: "goals_scored",    label: "Total Goals Scored" },
  { value: "fastest_time",    label: "Fastest Time (ascending)" },
];

// ── Custom field type ─────────────────────────────────────────────────────────

type CF = { label: string; type: string; mandatory: boolean; options: string };

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (program: Program) => void;
  program: Program | null;
  isBadminton?: boolean;
}

// ── Default format config per format ─────────────────────────────────────────

const defaultFormatConfig = (format: FixtureFormat): FixtureFormatConfig => {
  switch (format) {
    case "knockout":           return { seedingMethod: "snake", byeHandling: "top_seed_gets_bye" };
    case "sectional_knockout": return { numSections: 4, seedingMethod: "snake" };
    case "group_knockout":     return { numGroups: 4, advancePerGroup: 2, crossGroupPairing: "bwf" };
    case "round_robin":        return { pointsForWin: 2, pointsForDraw: 0, tiebreakOrder: ["head_to_head", "game_ratio", "point_ratio"] };
    case "league":             return { pointsForWin: 3, pointsForDraw: 1, homeAndAway: false, tiebreakOrder: ["goal_difference", "goals_scored", "head_to_head"] };
    case "heats_final":        return { numHeats: 4, qualifyPerHeat: 2, numFinalsGroups: 2 };
    default:                   return {};
  }
};

const defaultScoringRule = (format: FixtureFormat): ScoringRuleId => {
  switch (format) {
    case "league": return "football_90";
    default:       return "badminton_21";
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ProgramModal({ open, onClose, onSave, program, isBadminton = false }: Props) {
  const isEdit = !!program;

  // ── Core form state ───────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name:            "",
    gender:          "Mixed",
    minAge:          18,
    maxAge:          45,
    fee:             "0.00",
    paymentRequired: true,
    minPlayers:      1,
    maxPlayers:      1,
    minParticipants: 4,
    maxParticipants: 32,
    enableSbaId:          false,
    enableDocumentUpload: false,
    enableGuardianInfo:   false,
    enableRemark:         false,
    customFields:         [] as CF[],
  });

  // ── Fixture format state (kept separate for cleaner conditional rendering) ─
  const [fixtureFormat,  setFixtureFormat]  = useState<FixtureFormat>("knockout");
  const [scoringRule,    setScoringRule]     = useState<ScoringRuleId>("badminton_21");
  const [formatConfig,   setFormatConfig]   = useState<FixtureFormatConfig>(defaultFormatConfig("knockout"));
  const [formErrors,     setFormErrors]     = useState<Record<string, string>>({});

  // ── Populate on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (program) {
      setForm({
        name:            program.name,
        gender:          program.gender,
        minAge:          program.minAge,
        maxAge:          program.maxAge,
        fee:             program.fee.toFixed(2),
        paymentRequired: program.paymentRequired ?? true,
        minPlayers:      program.minPlayers,
        maxPlayers:      program.maxPlayers,
        minParticipants: program.minParticipants ?? 4,
        maxParticipants: program.maxParticipants,
        enableSbaId:          program.fields.enableSbaId,
        enableDocumentUpload: program.fields.enableDocumentUpload,
        enableGuardianInfo:   program.fields.enableGuardianInfo,
        enableRemark:         program.fields.enableRemark ?? false,
        customFields: program.fields.customFields.map(cf => ({
          label: cf.label, type: cf.type, mandatory: cf.required, options: cf.options || "",
        })),
      });
      setFixtureFormat(program.fixtureFormat ?? "knockout");
      setScoringRule(program.scoringRule ?? "badminton_21");
      setFormatConfig(program.formatConfig ?? defaultFormatConfig(program.fixtureFormat ?? "knockout"));
    } else {
      setForm({
        name: "", gender: "Mixed", minAge: 18, maxAge: 45,
        fee: "0.00", paymentRequired: true, minPlayers: 1, maxPlayers: 1,
        minParticipants: 4, maxParticipants: 32,
        enableSbaId: false, enableDocumentUpload: false,
        enableGuardianInfo: false, enableRemark: false, customFields: [],
      });
      setFixtureFormat("knockout");
      setScoringRule("badminton_21");
      setFormatConfig(defaultFormatConfig("knockout"));
    }
    setFormErrors({});
  }, [program, open]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const s = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const fc = (patch: Partial<FixtureFormatConfig>) => setFormatConfig(p => ({ ...p, ...patch }));

  const handleFormatChange = (fmt: FixtureFormat) => {
    setFixtureFormat(fmt);
    setFormatConfig(defaultFormatConfig(fmt));
    setScoringRule(defaultScoringRule(fmt));
  };

  // Custom fields
  const addCF    = () => s("customFields", [...form.customFields, { label: "", type: "text", mandatory: false, options: "" }]);
  const updateCF = (i: number, k: string, v: unknown) =>
    s("customFields", form.customFields.map((cf, idx) => idx === i ? { ...cf, [k]: v } : cf));
  const removeCF = (i: number) =>
    s("customFields", form.customFields.filter((_, idx) => idx !== i));

  // Tiebreak ordering toggle
  const toggleTiebreak = (criterion: TiebreakCriteria) => {
    const current = formatConfig.tiebreakOrder ?? [];
    if (current.includes(criterion)) {
      fc({ tiebreakOrder: current.filter(c => c !== criterion) });
    } else {
      fc({ tiebreakOrder: [...current, criterion] });
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim())                           errs.name       = "Program name is required";
    if (form.minAge > form.maxAge)                   errs.ageRange   = "Min age must be ≤ max age";
    if (form.minPlayers > form.maxPlayers)           errs.players    = "Min players must be ≤ max players";
    if (form.minParticipants > form.maxParticipants) errs.parts      = "Min participants must be ≤ max";
    if (parseFloat(form.fee) < 0)                    errs.fee        = "Fee cannot be negative";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Derive a display-friendly type label for backward compatibility
    const typeLabel = FIXTURE_FORMATS.find(f => f.value === fixtureFormat)?.label ?? "Knockout";

    const savedProgram: Program = {
      id:   program?.id || "",
      name: form.name,
      type: typeLabel,
      fixtureFormat,
      formatConfig,
      scoringRule,
      gender:             form.gender,
      minAge:             form.minAge,
      maxAge:             form.maxAge,
      fee:                parseFloat(form.fee) || 0,
      paymentRequired:    form.paymentRequired,
      minPlayers:         form.minPlayers,
      maxPlayers:         form.maxPlayers,
      minParticipants:    form.minParticipants,
      maxParticipants:    form.maxParticipants,
      currentParticipants: program?.currentParticipants ?? 0,
      status:             program?.status ?? "open",
      sbaRequired:        form.enableSbaId,
      fields: {
        enableSbaId:          form.enableSbaId,
        enableDocumentUpload: form.enableDocumentUpload,
        enableGuardianInfo:   form.enableGuardianInfo,
        enableRemark:         form.enableRemark,
        customFields: form.customFields.map(cf => ({
          label: cf.label, type: cf.type, required: cf.mandatory, options: cf.options || undefined,
        })),
      },
    };
    onSave(savedProgram);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0"
        style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}
      >
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="font-bold text-xl">
            {isEdit ? "Edit Program" : "Create Program"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-8 pb-8 space-y-7">

          {/* ── Basic info ── */}
          <Sec title="Basic Info">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <Lbl>Program Name *</Lbl>
                <input className="field-input" value={form.name} onChange={e => s("name", e.target.value)} />
                {formErrors.name && <Err>{formErrors.name}</Err>}
              </div>
              <div>
                <Lbl>Gender</Lbl>
                <select className="field-input" value={form.gender} onChange={e => s("gender", e.target.value)}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Mixed">Mixed</option>
                  <option value="Open">Open</option>
                </select>
              </div>
            </div>
          </Sec>

          {/* ── Fixture format ── */}
          <Sec title="Fixture Format">
            <div className="grid sm:grid-cols-2 gap-5 mb-5">
              <div>
                <Lbl>Format</Lbl>
                <select
                  className="field-input"
                  value={fixtureFormat}
                  onChange={e => handleFormatChange(e.target.value as FixtureFormat)}
                >
                  {FIXTURE_FORMATS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <p className="text-xs mt-1.5 opacity-50">
                  {FIXTURE_FORMATS.find(f => f.value === fixtureFormat)?.description}
                </p>
              </div>
              <div>
                <Lbl>Scoring Rule</Lbl>
                <select
                  className="field-input"
                  value={scoringRule}
                  onChange={e => setScoringRule(e.target.value as ScoringRuleId)}
                >
                  {SCORING_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Conditional config by format ── */}

            {/* knockout */}
            {fixtureFormat === "knockout" && (
              <div className="grid sm:grid-cols-2 gap-5 p-4" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <div>
                  <Lbl>Seeding Method</Lbl>
                  <select className="field-input" value={formatConfig.seedingMethod ?? "snake"}
                    onChange={e => fc({ seedingMethod: e.target.value as "snake" | "random" | "manual" })}>
                    <option value="snake">Snake (top seeds separated)</option>
                    <option value="random">Random Draw</option>
                    <option value="manual">Manual Assignment</option>
                  </select>
                </div>
                <div>
                  <Lbl>Bye Handling</Lbl>
                  <select className="field-input" value={formatConfig.byeHandling ?? "top_seed_gets_bye"}
                    onChange={e => fc({ byeHandling: e.target.value as "top_seed_gets_bye" | "random" })}>
                    <option value="top_seed_gets_bye">Top seed gets bye</option>
                    <option value="random">Random</option>
                  </select>
                  <p className="text-xs mt-1 opacity-50">Applies when participant count is not a power of 2</p>
                </div>
              </div>
            )}

            {/* sectional_knockout */}
            {fixtureFormat === "sectional_knockout" && (
              <div className="grid sm:grid-cols-2 gap-5 p-4" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <div>
                  <Lbl>Number of Sections</Lbl>
                  <select className="field-input" value={formatConfig.numSections ?? 4}
                    onChange={e => fc({ numSections: +e.target.value as 2 | 4 | 8 })}>
                    <option value={2}>2 Sections</option>
                    <option value={4}>4 Sections</option>
                    <option value={8}>8 Sections</option>
                  </select>
                  <p className="text-xs mt-1 opacity-50">Snake seeding distributes top seeds across sections</p>
                </div>
                <div>
                  <Lbl>Seeding Method</Lbl>
                  <select className="field-input" value={formatConfig.seedingMethod ?? "snake"}
                    onChange={e => fc({ seedingMethod: e.target.value as "snake" | "random" | "manual" })}>
                    <option value="snake">Snake</option>
                    <option value="random">Random</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
              </div>
            )}

            {/* group_knockout */}
            {fixtureFormat === "group_knockout" && (
              <div className="grid sm:grid-cols-3 gap-5 p-4" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <div>
                  <Lbl>Number of Groups</Lbl>
                  <select className="field-input" value={formatConfig.numGroups ?? 4}
                    onChange={e => fc({ numGroups: +e.target.value as 2 | 4 | 8 })}>
                    <option value={2}>2 Groups</option>
                    <option value={4}>4 Groups</option>
                    <option value={8}>8 Groups</option>
                  </select>
                </div>
                <div>
                  <Lbl>Advance Per Group</Lbl>
                  <select className="field-input" value={formatConfig.advancePerGroup ?? 2}
                    onChange={e => fc({ advancePerGroup: +e.target.value as 1 | 2 })}>
                    <option value={1}>Top 1</option>
                    <option value={2}>Top 2</option>
                  </select>
                </div>
                <div>
                  <Lbl>KO Pairing Style</Lbl>
                  <select className="field-input" value={formatConfig.crossGroupPairing ?? "bwf"}
                    onChange={e => fc({ crossGroupPairing: e.target.value as "bwf" | "standard" | "fifa" })}>
                    <option value="bwf">BWF (A1 vs B2, prevents rematch)</option>
                    <option value="standard">Standard (rank order)</option>
                    <option value="fifa">FIFA (World Cup style)</option>
                  </select>
                </div>
              </div>
            )}

            {/* round_robin */}
            {fixtureFormat === "round_robin" && (
              <div className="space-y-4 p-4" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Lbl>Points for Win</Lbl>
                    <input type="number" min={0} className="field-input" value={formatConfig.pointsForWin ?? 2}
                      onChange={e => fc({ pointsForWin: +e.target.value })} />
                  </div>
                  <div>
                    <Lbl>Points for Draw</Lbl>
                    <input type="number" min={0} className="field-input" value={formatConfig.pointsForDraw ?? 0}
                      onChange={e => fc({ pointsForDraw: +e.target.value })} />
                  </div>
                </div>
                <TiebreakSelector
                  selected={formatConfig.tiebreakOrder ?? []}
                  onToggle={toggleTiebreak}
                />
              </div>
            )}

            {/* league */}
            {fixtureFormat === "league" && (
              <div className="space-y-4 p-4" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Lbl>Points for Win</Lbl>
                    <input type="number" min={0} className="field-input" value={formatConfig.pointsForWin ?? 3}
                      onChange={e => fc({ pointsForWin: +e.target.value })} />
                  </div>
                  <div>
                    <Lbl>Points for Draw</Lbl>
                    <input type="number" min={0} className="field-input" value={formatConfig.pointsForDraw ?? 1}
                      onChange={e => fc({ pointsForDraw: +e.target.value })} />
                  </div>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm cursor-pointer p-3" style={{ border: "1px solid var(--color-table-border)" }}>
                  <span>Home &amp; Away (each pair plays twice)</span>
                  <Switch checked={formatConfig.homeAndAway ?? false}
                    onCheckedChange={v => fc({ homeAndAway: v })} />
                </label>
                <TiebreakSelector
                  selected={formatConfig.tiebreakOrder ?? []}
                  onToggle={toggleTiebreak}
                />
              </div>
            )}

            {/* heats_final */}
            {fixtureFormat === "heats_final" && (
              <div className="grid sm:grid-cols-3 gap-5 p-4" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <div>
                  <Lbl>Number of Heats</Lbl>
                  <input type="number" min={1} className="field-input" value={formatConfig.numHeats ?? 4}
                    onChange={e => fc({ numHeats: +e.target.value })} />
                </div>
                <div>
                  <Lbl>Qualify Per Heat</Lbl>
                  <input type="number" min={1} className="field-input" value={formatConfig.qualifyPerHeat ?? 2}
                    onChange={e => fc({ qualifyPerHeat: +e.target.value })} />
                  <p className="text-xs mt-1 opacity-50">Top N from each heat advance</p>
                </div>
                <div>
                  <Lbl>Number of Finals</Lbl>
                  <input type="number" min={1} className="field-input" value={formatConfig.numFinalsGroups ?? 1}
                    onChange={e => fc({ numFinalsGroups: +e.target.value })} />
                  <p className="text-xs mt-1 opacity-50">1 = A Final only · 2 = A + B Finals</p>
                </div>
              </div>
            )}
          </Sec>

          {/* ── Age eligibility ── */}
          <Sec title="Age Eligibility">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Lbl>Min Age</Lbl>
                <input type="number" className="field-input" value={form.minAge}
                  onChange={e => s("minAge", +e.target.value)} />
              </div>
              <div>
                <Lbl>Max Age</Lbl>
                <input type="number" className="field-input" value={form.maxAge}
                  onChange={e => s("maxAge", +e.target.value)} />
              </div>
            </div>
            {formErrors.ageRange && <Err>{formErrors.ageRange}</Err>}
          </Sec>

          {/* ── Capacity ── */}
          <Sec title="Capacity">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <Lbl>Min Participants</Lbl>
                <input type="number" className="field-input" value={form.minParticipants}
                  onChange={e => s("minParticipants", +e.target.value)} />
              </div>
              <div>
                <Lbl>Max Participants</Lbl>
                <input type="number" className="field-input" value={form.maxParticipants}
                  onChange={e => s("maxParticipants", +e.target.value)} />
              </div>
              <div>
                <Lbl>Min Players / Entry</Lbl>
                <input type="number" className="field-input" value={form.minPlayers}
                  onChange={e => s("minPlayers", +e.target.value)} />
              </div>
              <div>
                <Lbl>Max Players / Entry</Lbl>
                <input type="number" className="field-input" value={form.maxPlayers}
                  onChange={e => s("maxPlayers", +e.target.value)} />
              </div>
            </div>
            {formErrors.players && <Err>{formErrors.players}</Err>}
            {formErrors.parts   && <Err>{formErrors.parts}</Err>}
          </Sec>

          {/* ── Fee ── */}
          <Sec title="Fee">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer p-3 mb-4" style={{ border: "1px solid var(--color-table-border)" }}>
              <span className="font-semibold">Payment Required</span>
              <Switch checked={form.paymentRequired}
                onCheckedChange={v => { s("paymentRequired", v); if (!v) s("fee", "0.00"); }} />
            </label>
            {form.paymentRequired ? (
              <div>
                <Lbl>Registration Fee (SGD)</Lbl>
                <div className="flex">
                  <span className="px-3 flex items-center text-sm font-semibold opacity-60"
                    style={{ border: "1px solid var(--color-table-border)", borderRight: "none" }}>$</span>
                  <input
                    type="number" step="0.01" min="0"
                    className="field-input w-36"
                    style={{ borderLeft: "none" }}
                    value={form.fee}
                    onChange={e => s("fee", e.target.value)}
                    onBlur={e => s("fee", parseFloat(e.target.value || "0").toFixed(2))}
                  />
                </div>
                {formErrors.fee && <Err>{formErrors.fee}</Err>}
              </div>
            ) : (
              <p className="text-xs opacity-50">Free entry — no payment will be collected.</p>
            )}
          </Sec>

          {/* ── Optional fields ── */}
          <Sec title="Optional Fields">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { key: "enableDocumentUpload", label: "Document Upload" },
                { key: "enableGuardianInfo",   label: "Guardian Info" },
                { key: "enableRemark",         label: "Remark Field" },
                ...(isBadminton ? [{ key: "enableSbaId", label: "SBA ID Lookup" }] : []),
              ].map(opt => (
                <label key={opt.key}
                  className="flex items-center justify-between gap-3 text-sm cursor-pointer p-3"
                  style={{ border: "1px solid var(--color-table-border)" }}>
                  <span>{opt.label}</span>
                  <Switch checked={form[opt.key as keyof typeof form] as boolean}
                    onCheckedChange={v => s(opt.key, v)} />
                </label>
              ))}
            </div>
          </Sec>

          {/* ── Custom fields ── */}
          <Sec title="Custom Fields">
            <div className="space-y-3">
              {form.customFields.map((cf, idx) => (
                <div key={idx} className="p-4 space-y-3"
                  style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Lbl>Field Label</Lbl>
                      <input className="field-input" placeholder="e.g. Club Name, Emergency Contact"
                        value={cf.label} onChange={e => updateCF(idx, "label", e.target.value)} />
                    </div>
                    <div className="w-48">
                      <Lbl>Column Type</Lbl>
                      <select className="field-input" value={cf.type}
                        onChange={e => updateCF(idx, "type", e.target.value)}>
                        {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end pb-2 gap-4">
                      <label className="flex items-center justify-between gap-3 text-sm cursor-pointer whitespace-nowrap">
                        <span>Mandatory</span>
                        <Switch checked={cf.mandatory}
                          onCheckedChange={v => updateCF(idx, "mandatory", v)} />
                      </label>
                      <button onClick={() => removeCF(idx)} className="opacity-40 hover:opacity-80">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {cf.type === "select" && (
                    <div>
                      <Lbl>Options <span className="font-normal opacity-50">(comma-separated)</span></Lbl>
                      <input className="field-input" placeholder="XS, S, M, L, XL, XXL"
                        value={cf.options} onChange={e => updateCF(idx, "options", e.target.value)} />
                      {cf.options && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {cf.options.split(",").map(o => o.trim()).filter(Boolean).map(o => (
                            <span key={o} className="px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-hero-text)" }}>
                              {o}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addCF} className="flex items-center gap-1.5 text-sm font-medium mt-3"
              style={{ color: "var(--color-primary)" }}>
              <Plus className="h-4 w-4" /> Add Custom Field
            </button>
          </Sec>
        </div>

        {/* ── Errors ── */}
        {Object.keys(formErrors).length > 0 && (
          <div className="px-8 pb-2 space-y-1">
            {Object.values(formErrors).map((e, i) => (
              <p key={i} className="text-xs" style={{ color: "var(--badge-open-text)" }}>• {e}</p>
            ))}
          </div>
        )}

        <DialogFooter className="p-8 pt-0">
          <button onClick={onClose} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
          <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">
            {isEdit ? "Update Program" : "Create Program"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tiebreak selector subcomponent ────────────────────────────────────────────

function TiebreakSelector({ selected, onToggle }: {
  selected: TiebreakCriteria[];
  onToggle: (c: TiebreakCriteria) => void;
}) {
  return (
    <div>
      <Lbl>Tiebreak Order <span className="font-normal opacity-50">(select in priority order)</span></Lbl>
      <div className="flex flex-wrap gap-2 mt-1">
        {TIEBREAK_OPTIONS.map((opt, i) => {
          const idx = selected.indexOf(opt.value);
          const active = idx !== -1;
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity"
              style={{
                border: `1px solid ${active ? "var(--color-primary)" : "var(--color-table-border)"}`,
                backgroundColor: active ? "var(--color-primary)" : "transparent",
                color: active ? "var(--color-hero-text)" : "var(--color-body-text)",
              }}
            >
              {active && <span className="font-bold">{idx + 1}.</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs mt-2 opacity-50">
          Order: {selected.map((c, i) => `${i + 1}. ${TIEBREAK_OPTIONS.find(o => o.value === c)?.label}`).join(" → ")}
        </p>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider mb-4 pb-2"
        style={{ borderBottom: "1px solid var(--color-table-border)", color: "var(--color-primary)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold mb-2 opacity-70">{children}</label>;
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mt-1" style={{ color: "var(--badge-open-text)" }}>{children}</p>;
}