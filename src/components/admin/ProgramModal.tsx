import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Program } from "@/types/config";

const FIELD_TYPES = [
  { value: "text",   label: "Text" },
  { value: "number", label: "Number" },
  { value: "date",   label: "Date (Calendar)" },
  { value: "select", label: "Dropdown (Options)" },
];

type CF = { label: string; type: string; mandatory: boolean; options: string };

interface Props {
  open:        boolean;
  onClose:     () => void;
  onSave:      (program: Program) => void;
  program:     Program | null;
  isBadminton?: boolean;
}

export default function ProgramModal({ open, onClose, onSave, program, isBadminton = false }: Props) {
  const isEdit = !!program;

  const [form, setForm] = useState({
    name: "", gender: "Mixed", minAge: 18, maxAge: 45,
    fee: "0.00", paymentRequired: true, minPlayers: 1, maxPlayers: 1,
    minParticipants: 4, maxParticipants: 32,
    enableSbaId: false, enableDocumentUpload: false,
    enableGuardianInfo: false, enableRemark: false, customFields: [] as CF[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    } else {
      setForm({
        name: "", gender: "Mixed", minAge: 18, maxAge: 45,
        fee: "0.00", paymentRequired: true, minPlayers: 1, maxPlayers: 1,
        minParticipants: 4, maxParticipants: 32,
        enableSbaId: false, enableDocumentUpload: false,
        enableGuardianInfo: false, enableRemark: false, customFields: [],
      });
    }
    setFormErrors({});
  }, [program, open]);

  const s      = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const addCF  = () => s("customFields", [...form.customFields, { label: "", type: "text", mandatory: false, options: "" }]);
  const upCF   = (i: number, k: string, v: unknown) =>
    s("customFields", form.customFields.map((cf, idx) => idx === i ? { ...cf, [k]: v } : cf));
  const delCF  = (i: number) => s("customFields", form.customFields.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim())                           errs.name     = "Program name is required";
    if (form.minAge > form.maxAge)                   errs.ageRange = "Min age must be ≤ max age";
    if (form.minPlayers > form.maxPlayers)           errs.players  = "Min players must be ≤ max players";
    if (form.minParticipants > form.maxParticipants) errs.parts    = "Min participants must be ≤ max";
    if (parseFloat(form.fee) < 0)                    errs.fee      = "Fee cannot be negative";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSave({
      id:   program?.id || "",
      name: form.name,
      type: form.name,
      gender: form.gender, minAge: form.minAge, maxAge: form.maxAge,
      fee: parseFloat(form.fee) || 0, paymentRequired: form.paymentRequired,
      minPlayers: form.minPlayers, maxPlayers: form.maxPlayers,
      minParticipants: form.minParticipants, maxParticipants: form.maxParticipants,
      currentParticipants: program?.currentParticipants ?? 0,
      status: program?.status ?? "open",
      sbaRequired: form.enableSbaId,
      fields: {
        enableSbaId: form.enableSbaId, enableDocumentUpload: form.enableDocumentUpload,
        enableGuardianInfo: form.enableGuardianInfo, enableRemark: form.enableRemark,
        customFields: form.customFields.map(cf => ({
          label: cf.label, type: cf.type, required: cf.mandatory, options: cf.options || undefined,
        })),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0"
        style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="font-bold text-xl">{isEdit ? "Edit Program" : "Create Program"}</DialogTitle>
          <p className="text-xs opacity-50 mt-1">
            Fixture format (Knockout, Round Robin, etc.) is chosen when generating the draw — not here.
            Fixture mode is configured at the event level.
          </p>
        </DialogHeader>

        <div className="px-8 pb-8 space-y-7">

          {/* Basic info */}
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

          {/* Age */}
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

          {/* Capacity */}
          <Sec title="Capacity">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div><Lbl>Min Participants</Lbl><input type="number" className="field-input" value={form.minParticipants} onChange={e => s("minParticipants", +e.target.value)} /></div>
              <div><Lbl>Max Participants</Lbl><input type="number" className="field-input" value={form.maxParticipants} onChange={e => s("maxParticipants", +e.target.value)} /></div>
              <div><Lbl>Min Players / Entry</Lbl><input type="number" className="field-input" value={form.minPlayers} onChange={e => s("minPlayers", +e.target.value)} /></div>
              <div><Lbl>Max Players / Entry</Lbl><input type="number" className="field-input" value={form.maxPlayers} onChange={e => s("maxPlayers", +e.target.value)} /></div>
            </div>
            {formErrors.players && <Err>{formErrors.players}</Err>}
            {formErrors.parts   && <Err>{formErrors.parts}</Err>}
          </Sec>

          {/* Fee */}
          <Sec title="Fee">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer p-3 mb-4"
              style={{ border: "1px solid var(--color-table-border)" }}>
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
                  <input type="number" step="0.01" min="0" className="field-input w-36"
                    style={{ borderLeft: "none" }} value={form.fee}
                    onChange={e => s("fee", e.target.value)}
                    onBlur={e => s("fee", parseFloat(e.target.value || "0").toFixed(2))} />
                </div>
                {formErrors.fee && <Err>{formErrors.fee}</Err>}
              </div>
            ) : (
              <p className="text-xs opacity-50">Free entry — no payment will be collected.</p>
            )}
          </Sec>

          {/* Optional fields */}
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

          {/* Custom fields */}
          <Sec title="Custom Fields">
            <div className="space-y-3">
              {form.customFields.map((cf, idx) => (
                <div key={idx} className="p-4 space-y-3"
                  style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Lbl>Field Label</Lbl>
                      <input className="field-input" placeholder="e.g. Emergency Contact"
                        value={cf.label} onChange={e => upCF(idx, "label", e.target.value)} />
                    </div>
                    <div className="w-48">
                      <Lbl>Column Type</Lbl>
                      <select className="field-input" value={cf.type}
                        onChange={e => upCF(idx, "type", e.target.value)}>
                        {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end pb-2 gap-4">
                      <label className="flex items-center gap-3 text-sm cursor-pointer whitespace-nowrap">
                        <span>Mandatory</span>
                        <Switch checked={cf.mandatory} onCheckedChange={v => upCF(idx, "mandatory", v)} />
                      </label>
                      <button onClick={() => delCF(idx)} className="opacity-40 hover:opacity-80">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {cf.type === "select" && (
                    <div>
                      <Lbl>Options <span className="font-normal opacity-50">(comma-separated)</span></Lbl>
                      <input className="field-input" placeholder="XS, S, M, L, XL"
                        value={cf.options} onChange={e => upCF(idx, "options", e.target.value)} />
                      {cf.options && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {cf.options.split(",").map(o => o.trim()).filter(Boolean).map(o => (
                            <span key={o} className="px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-hero-text)" }}>{o}</span>
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