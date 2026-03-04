import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Program, CustomField } from "@/types/config";

interface ProgramModalProps {
  open: boolean;
  onClose: () => void;
  program: Program | null;
}

export default function ProgramModal({ open, onClose, program }: ProgramModalProps) {
  const isEdit = !!program;

  const [form, setForm] = useState({
    name: "",
    type: "Knockout",
    minAge: 18,
    maxAge: 45,
    gender: "Mixed",
    fee: 0,
    minPlayers: 1,
    maxPlayers: 1,
    maxParticipants: 32,
    paymentRequired: true,
    enableSbaId: false,
    enableDocumentUpload: false,
    enableGuardianInfo: false,
    enableRemark: false,
    customFields: [] as CustomField[],
  });

  useEffect(() => {
    if (program) {
      setForm({
        name: program.name,
        type: program.type,
        minAge: program.minAge,
        maxAge: program.maxAge,
        gender: program.gender,
        fee: program.fee,
        minPlayers: program.minPlayers,
        maxPlayers: program.maxPlayers,
        maxParticipants: program.maxParticipants,
        paymentRequired: true,
        enableSbaId: program.fields.enableSbaId,
        enableDocumentUpload: program.fields.enableDocumentUpload,
        enableGuardianInfo: program.fields.enableGuardianInfo,
        enableRemark: program.fields.enableRemark || false,
        customFields: [...program.fields.customFields],
      });
    } else {
      setForm({
        name: "",
        type: "Knockout",
        minAge: 18,
        maxAge: 45,
        gender: "Mixed",
        fee: 0,
        minPlayers: 1,
        maxPlayers: 1,
        maxParticipants: 32,
        paymentRequired: true,
        enableSbaId: false,
        enableDocumentUpload: false,
        enableGuardianInfo: false,
        enableRemark: false,
        customFields: [],
      });
    }
  }, [program, open]);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addCustomField = () => {
    setForm((prev) => ({
      ...prev,
      customFields: [...prev.customFields, { label: "", type: "text", required: false }],
    }));
  };

  const updateCustomField = (idx: number, key: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf, i) => i === idx ? { ...cf, [key]: value } : cf),
    }));
  };

  const removeCustomField = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    // In real app, save to backend
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="font-heading font-bold text-xl">
            {isEdit ? "Edit Program" : "Create Program"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-8 pt-6 space-y-6">
          {/* Basic Info */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Program Name *</label>
              <input className="field-input" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Program Type</label>
              <select className="field-input" value={form.type} onChange={(e) => updateField("type", e.target.value)}>
                <option value="Knockout">Knockout</option>
                <option value="Group Stage + Knockout">Group Stage + Knockout</option>
              </select>
            </div>
          </div>

          {/* Eligibility */}
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">Eligibility</h3>
            <div className="grid sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Min Age</label>
                <input type="number" className="field-input" value={form.minAge} onChange={(e) => updateField("minAge", +e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Max Age</label>
                <input type="number" className="field-input" value={form.maxAge} onChange={(e) => updateField("maxAge", +e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Gender</label>
                <select className="field-input" value={form.gender} onChange={(e) => updateField("gender", e.target.value)}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Capacity */}
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">Capacity</h3>
            <div className="grid sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Max Participants</label>
                <input type="number" className="field-input" value={form.maxParticipants} onChange={(e) => updateField("maxParticipants", +e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Min Players Per Entry</label>
                <input type="number" className="field-input" value={form.minPlayers} onChange={(e) => updateField("minPlayers", +e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Max Players Per Entry</label>
                <input type="number" className="field-input" value={form.maxPlayers} onChange={(e) => updateField("maxPlayers", +e.target.value)} />
              </div>
            </div>
          </div>

          {/* Fee */}
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">Fee</h3>
            <div className="grid sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Registration Fee (SGD)</label>
                <input type="number" className="field-input" value={form.fee} onChange={(e) => updateField("fee", +e.target.value)} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.paymentRequired} onChange={(e) => updateField("paymentRequired", e.target.checked)} />
                  Payment Required
                </label>
              </div>
            </div>
          </div>

          {/* Optional Field Toggles */}
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">Optional Fields</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { key: "enableSbaId", label: "SBA ID" },
                { key: "enableDocumentUpload", label: "Document Upload" },
                { key: "enableGuardianInfo", label: "Guardian Info" },
                { key: "enableRemark", label: "Remark" },
              ].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer p-3" style={{ border: "1px solid var(--color-table-border)" }}>
                  <input
                    type="checkbox"
                    checked={(form as any)[opt.key]}
                    onChange={(e) => updateField(opt.key, e.target.checked)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold opacity-80">Custom Fields</h3>
              <button onClick={addCustomField} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                <Plus className="h-3 w-3" /> Add Field
              </button>
            </div>
            {form.customFields.map((cf, idx) => (
              <div key={idx} className="flex items-center gap-3 mb-3">
                <input
                  className="field-input flex-1"
                  placeholder="Field label"
                  value={cf.label}
                  onChange={(e) => updateCustomField(idx, "label", e.target.value)}
                />
                <select className="field-input w-28" value={cf.type} onChange={(e) => updateCustomField(idx, "type", e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Select</option>
                </select>
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input type="checkbox" checked={cf.required} onChange={(e) => updateCustomField(idx, "required", e.target.checked)} />
                  Req
                </label>
                <button onClick={() => removeCustomField(idx)} className="opacity-50 hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {form.customFields.length === 0 && (
              <p className="text-xs opacity-40">No custom fields added.</p>
            )}
          </div>
        </div>

        <DialogFooter className="p-8 pt-0">
          <button onClick={onClose} className="btn-outline px-5 py-2.5 text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm font-semibold">
            {isEdit ? "Update Program" : "Create Program"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
