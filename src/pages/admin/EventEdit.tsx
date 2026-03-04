import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit2, Users, Save, X, Image, Trash2 } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent, Program } from "@/types/config";
import { formatDate, getEventStatus } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import ProgramModal from "@/components/admin/ProgramModal";
import SeedingModal from "@/components/admin/SeedingModal";

const SPORT_TYPES = ["Badminton", "Football", "Basketball", "Volleyball", "Swimming", "Athletics", "Other"];
const MAX_IMAGE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function EventEdit() {
  const { eventId } = useParams();
  const navigate    = useNavigate();
  const isNew       = eventId === "new";
  const existing    = config.events.find(e => e.id === eventId) as TournamentEvent | undefined;

  const [editing, setEditing] = useState(isNew);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram,   setEditingProgram]   = useState<Program | null>(null);
  const [seedingOpen,      setSeedingOpen]      = useState(false);
  const [seedingProgramId, setSeedingProgramId] = useState("");

  // Gallery state
  const [gallery, setGallery]         = useState<string[]>((existing as any)?.galleryUrls || []);
  const [galleryError, setGalleryError] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name:            existing?.name            || "",
    description:     existing?.description     || "",
    venue:           existing?.venue           || "",
    venueAddress:    existing?.venueAddress    || "",
    eventStartDate:  existing?.eventStartDate  || "",
    eventEndDate:    existing?.eventEndDate    || "",
    openDate:        existing?.openDate        || "",
    closeDate:       existing?.closeDate       || "",
    maxParticipants: existing?.maxParticipants || 100,
    sponsorInfo:     existing?.sponsorInfo     || "",
    bannerUrl:       existing?.bannerUrl       || "",
    prospectusUrl:   existing?.prospectusUrl   || "",
    // Sport settings at event level
    isSports:    (existing as any)?.isSports    ?? true,
    sportType:   (existing as any)?.sportType   || "Badminton",
    fixtureMode: (existing as any)?.fixtureMode || "internal" as "internal" | "external",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const isBadminton = form.isSports && form.sportType === "Badminton";

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGalleryError("");
    const files = Array.from(e.target.files || []);
    const errs: string[] = [];
    const newUrls: string[] = [];

    files.forEach(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        errs.push(`${f.name}: only JPG, PNG, WEBP allowed`);
        return;
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        errs.push(`${f.name}: exceeds ${MAX_IMAGE_MB}MB limit`);
        return;
      }
      newUrls.push(URL.createObjectURL(f));
    });

    if (errs.length) setGalleryError(errs.join(" · "));
    setGallery(prev => [...prev, ...newUrls]);
    if (galleryRef.current) galleryRef.current.value = "";
  };

  const removeGalleryImage = (idx: number) =>
    setGallery(prev => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name  = "Required";
    if (!form.venue.trim()) e.venue = "Required";
    if (form.eventEndDate && form.eventStartDate && form.eventEndDate < form.eventStartDate)
      e.eventEndDate = "Must be after start date";
    if (form.closeDate && form.eventStartDate && form.closeDate >= form.eventStartDate)
      e.closeDate = "Must be before event start";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setEditing(false);
  };

  const programs = existing?.programs || [];
  const status   = existing ? getEventStatus(existing) : undefined;

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/events")}
            className="p-2 hover:opacity-60 transition-opacity">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold text-2xl">
              {isNew ? "Create New Event" : existing?.name || "Event"}
            </h1>
            {status && <div className="mt-1"><StatusBadge status={status} /></div>}
          </div>
        </div>
        <div className="flex gap-3">
          {!isNew && !editing && (
            <button onClick={() => setEditing(true)}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
              <Edit2 className="h-4 w-4" /> Edit Event
            </button>
          )}
          {editing && (
            <>
              {!isNew && (
                <button onClick={() => setEditing(false)}
                  className="btn-outline flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
                  <X className="h-4 w-4" /> Cancel
                </button>
              )}
              <button onClick={handleSave}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                <Save className="h-4 w-4" /> Save Event
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Event Details ── */}
      <div className="mb-8 p-8" style={{ border: "1px solid var(--color-table-border)" }}>
        <SectionTitle>Event Details</SectionTitle>
        <div className="grid md:grid-cols-2 gap-6">
          <FF label="Event Name *" error={errors.name}>
            <input className="field-input" value={form.name}
              onChange={e => set("name", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Venue Name *" error={errors.venue}>
            <input className="field-input" value={form.venue}
              onChange={e => set("venue", e.target.value)} disabled={!editing} />
          </FF>
          <div className="md:col-span-2">
            <FF label="Venue Address">
              <input className="field-input" value={form.venueAddress}
                onChange={e => set("venueAddress", e.target.value)} disabled={!editing} />
            </FF>
          </div>
          <FF label="Event Start Date">
            <input type="date" className="field-input" value={form.eventStartDate}
              onChange={e => set("eventStartDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Event End Date" error={errors.eventEndDate}>
            <input type="date" className="field-input" value={form.eventEndDate}
              onChange={e => set("eventEndDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Registration Open Date">
            <input type="date" className="field-input" value={form.openDate}
              onChange={e => set("openDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Registration Close Date" error={errors.closeDate}>
            <input type="date" className="field-input" value={form.closeDate}
              onChange={e => set("closeDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Max Participants">
            <input type="number" className="field-input" value={form.maxParticipants}
              onChange={e => set("maxParticipants", +e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Sponsor Information">
            <input className="field-input" value={form.sponsorInfo}
              onChange={e => set("sponsorInfo", e.target.value)} disabled={!editing} />
          </FF>
          <div className="md:col-span-2">
            <FF label="Description">
              <textarea className="field-input" rows={3} value={form.description}
                onChange={e => set("description", e.target.value)} disabled={!editing} />
            </FF>
          </div>
          <FF label="Prospectus PDF">
            {editing
              ? <input type="file" accept=".pdf" className="field-input" />
              : <p className="text-sm opacity-60">{form.prospectusUrl || "No prospectus uploaded"}</p>}
          </FF>
          <div className="md:col-span-2">
            <p className="block text-xs font-semibold mb-2 opacity-70">
              Consent Statement
            </p>
            <div className="p-3 text-xs opacity-60"
              style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
              Managed globally in{" "}
              <a href="/admin/config" className="underline" style={{ color: "var(--color-primary)" }}>
                Master Configuration
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sport / Fixture Settings ── */}
      <div className="mb-8 p-8" style={{ border: "1px solid var(--color-table-border)" }}>
        <SectionTitle>Sport & Fixture Settings</SectionTitle>
        <div className="space-y-5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isSports} disabled={!editing}
              onChange={e => set("isSports", e.target.checked)} />
            This is a sports event
          </label>

          {form.isSports && (
            <div className="grid sm:grid-cols-2 gap-6">
              <FF label="Sport">
                <select className="field-input" value={form.sportType}
                  onChange={e => set("sportType", e.target.value)} disabled={!editing}>
                  {SPORT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FF>

              <FF label="Fixture Management Mode">
                {editing ? (
                  <div className="flex gap-0">
                    {(["internal", "external"] as const).map(m => (
                      <button key={m} type="button" onClick={() => set("fixtureMode", m)}
                        className="px-4 py-2.5 text-sm font-semibold transition-colors"
                        style={{
                          backgroundColor: form.fixtureMode === m ? "var(--color-primary)" : "transparent",
                          color: form.fixtureMode === m ? "var(--color-hero-text)" : "var(--color-body-text)",
                          border: `1px solid ${form.fixtureMode === m ? "var(--color-primary)" : "var(--color-table-border)"}`,
                        }}>
                        {m === "internal" ? "Internal (Built-in)" : "External (TournamentSoftware)"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium capitalize">
                    {form.fixtureMode === "internal" ? "Internal (Built-in)" : "External (TournamentSoftware)"}
                  </p>
                )}
              </FF>
            </div>
          )}
        </div>
      </div>

      {/* ── Gallery ── */}
      <div className="mb-8 p-8" style={{ border: "1px solid var(--color-table-border)" }}>
        <SectionTitle>Event Gallery</SectionTitle>
        <p className="text-xs opacity-60 mb-4">
          Upload multiple images (JPG, PNG, WEBP · max {MAX_IMAGE_MB}MB each)
        </p>

        {editing && (
          <>
            <label className="inline-flex items-center gap-2 btn-outline px-5 py-2.5 text-sm font-medium cursor-pointer mb-3">
              <Image className="h-4 w-4" /> Upload Images
              <input ref={galleryRef} type="file" multiple accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handleGalleryUpload} />
            </label>
            {galleryError && (
              <p className="text-xs mb-3" style={{ color: "var(--badge-open-text)" }}>{galleryError}</p>
            )}
          </>
        )}

        {gallery.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {gallery.map((url, i) => (
              <div key={i} className="relative group aspect-video overflow-hidden"
                style={{ border: "1px solid var(--color-table-border)" }}>
                <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                {editing && (
                  <button onClick={() => removeGalleryImage(i)}
                    className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm opacity-40">No images uploaded yet.</p>
        )}
      </div>

      {/* ── Programs ── always visible, even for new event ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <SectionTitle>Programs</SectionTitle>
          <button onClick={() => { setEditingProgram(null); setProgramModalOpen(true); }}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Add Program
          </button>
        </div>

        {isNew && programs.length === 0 && (
          <div className="p-5 text-sm opacity-60 text-center"
            style={{ border: "1px dashed var(--color-table-border)" }}>
            Save the event first, then add programs — or add programs now and save everything together.
          </div>
        )}

        {programs.length > 0 && (
          <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Program Name</th>
                  <th>Format</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Fee</th>
                  <th>Min / Max Participants</th>
                  <th>Filled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map(prog => (
                  <tr key={prog.id}>
                    <td className="font-medium">{prog.name}</td>
                    <td className="text-sm">{prog.type}</td>
                    <td className="text-sm">{prog.minAge}–{prog.maxAge}</td>
                    <td className="text-sm">{prog.gender}</td>
                    <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>
                      {prog.fee > 0 ? `$${prog.fee.toFixed(2)}` : "Free"}
                    </td>
                    <td className="text-sm">{prog.minParticipants} / {prog.maxParticipants}</td>
                    <td className="text-sm">
                      <span>{prog.currentParticipants} / {prog.maxParticipants}</span>
                      <div className="h-1 mt-1 w-20" style={{ backgroundColor: "var(--color-table-border)" }}>
                        <div className="h-1 transition-all"
                          style={{
                            width: `${Math.min(100, (prog.currentParticipants / prog.maxParticipants) * 100)}%`,
                            backgroundColor: prog.currentParticipants >= prog.maxParticipants
                              ? "var(--badge-open-text)" : "var(--color-primary)",
                          }} />
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <IBtn title="Edit Program" onClick={() => { setEditingProgram(prog); setProgramModalOpen(true); }}>
                          <Edit2 className="h-4 w-4" />
                        </IBtn>
                        <IBtn title="View Registrations" onClick={() => navigate(`/admin/registrations?event=${eventId}&program=${prog.id}`)}>
                          <Users className="h-4 w-4" />
                        </IBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProgramModal
        open={programModalOpen}
        onClose={() => { setProgramModalOpen(false); setEditingProgram(null); }}
        program={editingProgram}
        isBadminton={isBadminton}
      />
      <SeedingModal
        open={seedingOpen}
        onClose={() => setSeedingOpen(false)}
        programId={seedingProgramId}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-bold text-base mb-5 pb-3"
      style={{ borderBottom: "1px solid var(--color-table-border)", color: "var(--color-heading)" }}>
      {children}
    </h2>
  );
}
function FF({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-2 opacity-70">{label}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: "var(--badge-open-text)" }}>{error}</p>}
    </div>
  );
}
function IBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick}
      className="p-2 transition-opacity hover:opacity-60"
      style={{ color: "var(--color-primary)" }}>
      {children}
    </button>
  );
}