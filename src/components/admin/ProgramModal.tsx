import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Program } from "@/types/config";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (program: Program) => void;
  program: Program | null;
  isBadminton?: boolean;
}

const FIELD_TYPES = [
  { value: "text",   label: "Text"               },
  { value: "number", label: "Number"              },
  { value: "date",   label: "Date (Calendar)"     },
  { value: "select", label: "Dropdown (Options)"  },
];

type CF = { label: string; type: string; mandatory: boolean; options: string };

export default function ProgramModal({ open, onClose, onSave, program, isBadminton = false }: Props) {
  const isEdit = !!program;

  const [form, setForm] = useState({
    name:            "",
    type:            "Knockout",
    minAge:          18,
    maxAge:          45,
    gender:          "Mixed",
    fee:             "0.00",
    paymentRequired: true,
    minPlayers:      1,
    maxPlayers:      1,
    minParticipants: 4,
    maxParticipants: 32,
    // Optional fields
    enableSbaId:          false,
    enableDocumentUpload: false,
    enableGuardianInfo:   false,
    enableRemark:         false,
    customFields: [] as CF[],
  });

  useEffect(() => {
    if (!open) return;
    if (program) {
      setForm({
        name:            program.name,
        type:            program.type,
        minAge:          program.minAge,
        maxAge:          program.maxAge,
        gender:          program.gender,
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
    } else {
      setForm({
        name: "", type: "Knockout", minAge: 18, maxAge: 45, gender: "Mixed",
        fee: "0.00", paymentRequired: true, minPlayers: 1, maxPlayers: 1,
        minParticipants: 4, maxParticipants: 32,
        enableSbaId: false, enableDocumentUpload: false,
        enableGuardianInfo: false, enableRemark: false, customFields: [],
      });
    }
  }, [program, open]);

  const s = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const addCF = () =>
    s("customFields", [...form.customFields, { label: "", type: "text", mandatory: false, options: "" }]);

  const updateCF = (i: number, k: string, v: any) =>
    s("customFields", form.customFields.map((cf, idx) => idx === i ? { ...cf, [k]: v } : cf));

  const removeCF = (i: number) =>
    s("customFields", form.customFields.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!form.name.trim()) return;
    const savedProgram: Program = {
      id: program?.id || "",          // ID assigned by parent on create
      name: form.name,
      type: form.type,
      minAge: form.minAge,
      maxAge: form.maxAge,
      gender: form.gender,
      fee: parseFloat(form.fee) || 0,
      paymentRequired: form.paymentRequired,
      minPlayers: form.minPlayers,
      maxPlayers: form.maxPlayers,
      minParticipants: form.minParticipants,
      maxParticipants: form.maxParticipants,
      currentParticipants: program?.currentParticipants ?? 0,
      status: program?.status ?? "open",
      sbaRequired: form.enableSbaId,
      fields: {
        enableSbaId:          form.enableSbaId,
        enableDocumentUpload: form.enableDocumentUpload,
        enableGuardianInfo:   form.enableGuardianInfo,
        enableRemark:         form.enableRemark,
        customFields: form.customFields.map(cf => ({
          label:    cf.label,
          type:     cf.type,
          required: cf.mandatory,
          options:  cf.options || undefined,
        })),
      },
    };
    onSave(savedProgram);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0"
        style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="font-bold text-xl">
            {isEdit ? "Edit Program" : "Create Program"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-8 pb-8 space-y-7">

          {/* ── Basic ── */}
          <Sec title="Basic Info">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <Lbl>Program Name *</Lbl>
                <input className="field-input" value={form.name} onChange={e => s("name", e.target.value)} />
              </div>
              <div>
                <Lbl>Format / Type</Lbl>
                <select className="field-input" value={form.type} onChange={e => s("type", e.target.value)}>
                  <option value="Knockout">Knockout</option>
                  <option value="Group Stage + Knockout">Group Stage + Knockout</option>
                  <option value="Round Robin">Round Robin</option>
                  <option value="League">League</option>
                </select>
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

          {/* ── Eligibility ── */}
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
                <Lbl>Min Participants / Entry</Lbl>
                <input type="number" className="field-input" value={form.minPlayers}
                  onChange={e => s("minPlayers", +e.target.value)} />
              </div>
              <div>
                <Lbl>Max Participants / Entry</Lbl>
                <input type="number" className="field-input" value={form.maxPlayers}
                  onChange={e => s("maxPlayers", +e.target.value)} />
              </div>
            </div>
          </Sec>

          {/* ── Fee ── */}
          <Sec title="Fee">
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <Lbl>Registration Fee (SGD)</Lbl>
                <div className="flex">
                  <span className="px-3 flex items-center text-sm font-semibold opacity-60"
                    style={{ border: "1px solid var(--color-table-border)", borderRight: "none" }}>$</span>
                  <input type="number" step="0.01" min="0"
                    className="field-input w-36"
                    style={{ borderLeft: "none" }}
                    value={form.fee}
                    disabled={!form.paymentRequired}
                    onChange={e => s("fee", e.target.value)}
                    onBlur={e => s("fee", parseFloat(e.target.value || "0").toFixed(2))} />
                </div>
              </div>
              <div className="pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.paymentRequired}
                    onChange={e => {
                      s("paymentRequired", e.target.checked);
                      if (!e.target.checked) s("fee", "0.00");
                    }} />
                  Payment Required
                </label>
                {!form.paymentRequired && (
                  <p className="text-xs mt-1 opacity-50">Fee set to $0.00 (free entry)</p>
                )}
              </div>
            </div>
          </Sec>

          {/* ── Optional Fields ── */}
          <Sec title="Optional Fields">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { key: "enableDocumentUpload", label: "Document Upload"  },
                { key: "enableGuardianInfo",   label: "Guardian Info"    },
                { key: "enableRemark",         label: "Remark Field"     },
                // SBA ID lookup only meaningful for Badminton
                ...(isBadminton ? [{ key: "enableSbaId", label: "SBA ID Lookup" }] : []),
              ].map(opt => (
                <label key={opt.key}
                  className="flex items-center gap-2 text-sm cursor-pointer p-3"
                  style={{ border: "1px solid var(--color-table-border)" }}>
                  <input type="checkbox" checked={form[opt.key as keyof typeof form] as boolean}
                    onChange={e => s(opt.key, e.target.checked)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </Sec>

          {/* ── Custom Fields ── */}
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
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
                        <input type="checkbox" checked={cf.mandatory}
                          onChange={e => updateCF(idx, "mandatory", e.target.checked)} />
                        Mandatory
                      </label>
                      <button onClick={() => removeCF(idx)} className="opacity-40 hover:opacity-80">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {cf.type === "select" && (
                    <div>
                      <Lbl>Options <span className="font-normal opacity-50">(comma-separated e.g. XS, S, M, L, XL, XXL)</span></Lbl>
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
            <button onClick={addCF}
              className="flex items-center gap-1.5 text-sm font-medium mt-3"
              style={{ color: "var(--color-primary)" }}>
              <Plus className="h-4 w-4" /> Add Custom Field
            </button>
          </Sec>
        </div>

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