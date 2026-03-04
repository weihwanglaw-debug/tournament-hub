import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Settings, Users, Save, X } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent, Program, CustomField } from "@/types/config";
import { formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import { getEventStatus } from "@/lib/eventUtils";
import ProgramModal from "@/components/admin/ProgramModal";
import SeedingModal from "@/components/admin/SeedingModal";

export default function EventEdit() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const isNew = eventId === "new";
  const existingEvent = config.events.find((e) => e.id === eventId) as TournamentEvent | undefined;

  const [editing, setEditing] = useState(isNew);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [seedingModalOpen, setSeedingModalOpen] = useState(false);
  const [seedingProgramId, setSeedingProgramId] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: existingEvent?.name || "",
    description: existingEvent?.description || "",
    venue: existingEvent?.venue || "",
    venueAddress: existingEvent?.venueAddress || "",
    eventStartDate: existingEvent?.eventStartDate || "",
    eventEndDate: existingEvent?.eventEndDate || "",
    openDate: existingEvent?.openDate || "",
    closeDate: existingEvent?.closeDate || "",
    maxParticipants: existingEvent?.maxParticipants || 100,
    sponsorInfo: existingEvent?.sponsorInfo || "",
    consentStatement: existingEvent?.consentStatement || "",
    bannerUrl: existingEvent?.bannerUrl || "",
    prospectusUrl: existingEvent?.prospectusUrl || "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const updateField = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.venue.trim()) errs.venue = "Required";
    if (form.eventStartDate && form.eventEndDate && form.eventEndDate <= form.eventStartDate) {
      errs.eventEndDate = "Must be after start date";
    }
    if (form.closeDate && form.eventStartDate && form.closeDate >= form.eventStartDate) {
      errs.closeDate = "Must be before event start date";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    // In a real app, this would save to backend
    setEditing(false);
  };

  const programs = existingEvent?.programs || [];
  const status = existingEvent ? getEventStatus(existingEvent) : undefined;

  const openProgramModal = (prog?: Program) => {
    setEditingProgram(prog || null);
    setProgramModalOpen(true);
  };

  const openSeedingModal = (programId: string) => {
    setSeedingProgramId(programId);
    setSeedingModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/events")}
            className="p-2 hover:bg-black/5 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-heading font-bold text-2xl">
              {isNew ? "Create New Event" : existingEvent?.name || "Event"}
            </h1>
            {status && <StatusBadge status={status} />}
          </div>
        </div>
        <div className="flex gap-3">
          {!isNew && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <Edit className="h-4 w-4" /> Edit Event
            </button>
          )}
          {editing && (
            <>
              {!isNew && (
                <button
                  onClick={() => setEditing(false)}
                  className="btn-outline flex items-center gap-2 px-5 py-2.5 text-sm font-medium"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
              >
                <Save className="h-4 w-4" /> Save Event
              </button>
            </>
          )}
        </div>
      </div>

      {/* Event Form */}
      <div className="mb-12 p-8" style={{ border: "1px solid var(--color-table-border)", backgroundColor: editing ? "var(--color-row-hover)" : "transparent" }}>
        <h2 className="font-heading font-bold text-lg mb-6">Event Details</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <FormField label="Event Name *" error={formErrors.name}>
            <input className="field-input" value={form.name} onChange={(e) => updateField("name", e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Venue Name *" error={formErrors.venue}>
            <input className="field-input" value={form.venue} onChange={(e) => updateField("venue", e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Venue Address">
            <input className="field-input" value={form.venueAddress} onChange={(e) => updateField("venueAddress", e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Maximum Participants">
            <input type="number" className="field-input" value={form.maxParticipants} onChange={(e) => updateField("maxParticipants", +e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Event Start Date">
            <input type="date" className="field-input" value={form.eventStartDate} onChange={(e) => updateField("eventStartDate", e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Event End Date" error={formErrors.eventEndDate}>
            <input type="date" className="field-input" value={form.eventEndDate} onChange={(e) => updateField("eventEndDate", e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Registration Open Date">
            <input type="date" className="field-input" value={form.openDate} onChange={(e) => updateField("openDate", e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Registration Close Date" error={formErrors.closeDate}>
            <input type="date" className="field-input" value={form.closeDate} onChange={(e) => updateField("closeDate", e.target.value)} disabled={!editing} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Event Description">
              <textarea className="field-input" rows={3} value={form.description} onChange={(e) => updateField("description", e.target.value)} disabled={!editing} />
            </FormField>
          </div>
          <FormField label="Sponsor Information">
            <input className="field-input" value={form.sponsorInfo} onChange={(e) => updateField("sponsorInfo", e.target.value)} disabled={!editing} />
          </FormField>
          <FormField label="Banner Image">
            {editing ? (
              <input type="file" accept="image/*" className="field-input" />
            ) : (
              <p className="text-sm opacity-60">{form.bannerUrl || "No banner uploaded"}</p>
            )}
          </FormField>
          <FormField label="Prospectus PDF">
            {editing ? (
              <input type="file" accept=".pdf" className="field-input" />
            ) : (
              <p className="text-sm opacity-60">{form.prospectusUrl || "No prospectus uploaded"}</p>
            )}
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Consent Statement">
              <textarea className="field-input" rows={3} value={form.consentStatement} onChange={(e) => updateField("consentStatement", e.target.value)} disabled={!editing} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Programs Section */}
      {!isNew && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-bold text-lg">Programs</h2>
            <button
              onClick={() => openProgramModal()}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Add Program
            </button>
          </div>

          <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th className="text-right">Fee</th>
                  <th className="text-center">Capacity</th>
                  <th className="text-center">Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((prog) => (
                  <tr key={prog.id}>
                    <td className="font-medium">{prog.name}</td>
                    <td>{prog.type}</td>
                    <td>{prog.minAge}–{prog.maxAge}</td>
                    <td>{prog.gender}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--color-primary)" }}>${prog.fee}</td>
                    <td className="text-center">{prog.maxParticipants}</td>
                    <td className="text-center">
                      {status && <StatusBadge status={status} />}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openProgramModal(prog)}
                          className="p-2 hover:bg-black/5 transition-colors"
                          title="Edit Program"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openSeedingModal(prog.id)}
                          className="p-2 hover:bg-black/5 transition-colors"
                          title="Configure Seeding"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/registrations?event=${eventId}&program=${prog.id}`)}
                          className="p-2 hover:bg-black/5 transition-colors"
                          title="View Registrations"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {programs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 opacity-40">
                      No programs yet. Click "Add Program" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProgramModal
        open={programModalOpen}
        onClose={() => { setProgramModalOpen(false); setEditingProgram(null); }}
        program={editingProgram}
      />

      <SeedingModal
        open={seedingModalOpen}
        onClose={() => setSeedingModalOpen(false)}
        programId={seedingProgramId}
      />
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-2 opacity-70">{label}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: "var(--badge-open-text)" }}>{error}</p>}
    </div>
  );
}
