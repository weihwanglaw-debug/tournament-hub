import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit2, Users, Save, X, Image, Trash2, Scissors, MoreVertical } from "lucide-react";
import type { TournamentEvent, Program } from "@/types/config";
import { formatDate, getEventStatus } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import ProgramModal from "@/components/admin/ProgramModal";
import SeedingModal from "@/components/admin/SeedingModal";
import { Switch } from "@/components/ui/switch";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import ActionDropdownPortal from "@/components/ui/ActionDropdownPortal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  apiGetEvent, apiCreateEvent, apiUpdateEvent, apiDeleteEvent,
  apiAddProgram, apiUpdateProgram, apiDeleteProgram,
  apiUploadFile, assetUrl,
} from "@/lib/api";

const MAX_IMAGE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PDF_MB = 8;

function isBlobUrl(url: string) {
  return url.startsWith("blob:");
}


export default function EventEdit() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const isNew = eventId === "new";
  const [event,    setEvent]   = useState<TournamentEvent | null>(null);
  const [loading,  setLoading] = useState(!isNew);
  const [saving,   setSaving]  = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (isNew) return;
    apiGetEvent(eventId!).then(r => {
      if (r.error) { setApiError(r.error.message); return; }
      const ev = r.data!;
      setEvent(ev);
      setPrograms(ev.programs);
      const safeGallery = (ev.galleryUrls || []).filter((u) => !isBlobUrl(u));
      if (safeGallery.length !== (ev.galleryUrls || []).length) {
        setGalleryError("Some previously selected images were temporary previews and can’t be loaded after refresh. Please re-upload them.");
      }
      setGallery(safeGallery);
      setForm({
        name:           ev.name,
        description:    ev.description || "",
        venue:          ev.venue,
        venueAddress:   ev.venueAddress || "",
        eventStartDate: ev.eventStartDate,
        eventEndDate:   ev.eventEndDate || "",
        openDate:       ev.openDate,
        closeDate:      ev.closeDate,
        maxParticipants: ev.maxParticipants || 100,
        sponsorInfo:    ev.sponsorInfo || "",
        bannerUrl:      ev.bannerUrl || "",
        prospectusUrl:  ev.prospectusUrl || "",
        consentStatement: ev.consentStatement || "",
        isSports:       ev.isSports ?? true,
        sportType:      ev.sportType || "Badminton",
        fixtureMode:    (ev.fixtureMode || "internal") as "internal" | "external" | "not_required",
      });
    }).finally(() => setLoading(false));
  }, [eventId, isNew]);

  const [editing, setEditing] = useState(isNew);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [seedingOpen, setSeedingOpen] = useState(false);
  const [seedingProgramId, setSeedingProgramId] = useState("");
  const [openAction, setOpenAction] = useState<{ prog: Program; anchorEl: HTMLElement } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryError, setGalleryError] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const [prospectusName, setProspectusName] = useState("");
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [bannerError,    setBannerError]    = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [uploadingProspectus, setUploadingProspectus] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "", venue: "", venueAddress: "",
    eventStartDate: "", eventEndDate: "", openDate: "", closeDate: "",
    maxParticipants: 100, sponsorInfo: "", bannerUrl: "", prospectusUrl: "",
    consentStatement: "",
    isSports: true, sportType: "Badminton",
    fixtureMode: "internal" as "internal" | "external" | "not_required",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(p => ({ ...p, [k]: v }));
  const RACKET_SPORTS = ["Badminton", "Tennis", "Squash", "Table Tennis", "Pickleball"];
  const TEAM_SPORTS   = ["Basketball", "Football", "Volleyball", "Rugby", "Hockey", "Netball"];
  const isRacketSport = form.isSports && RACKET_SPORTS.includes(form.sportType);
  const isTeamSport   = form.isSports && TEAM_SPORTS.includes(form.sportType);
  const isBadminton   = form.isSports && form.sportType === "Badminton";

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGalleryError("");
    const files = Array.from(e.target.files || []);
    const errs: string[] = [];
    const newUrls: Array<Promise<string | null>> = [];
    files.forEach(f => {
      if (!ALLOWED_TYPES.includes(f.type)) { errs.push(`${f.name}: only JPG, PNG, WEBP allowed`); return; }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) { errs.push(`${f.name}: exceeds ${MAX_IMAGE_MB}MB limit`); return; }
      newUrls.push(
        apiUploadFile(f, "events/gallery").then((r) => {
          if (r.error) { errs.push(`${f.name}: ${r.error.message}`); return null; }
          return r.data;
        }),
      );
    });
    if (errs.length) setGalleryError(errs.join(" · "));
    setUploadingGallery(true);
    void Promise.all(newUrls).then((urls) => {
      const good = urls.filter(Boolean) as string[];
      if (errs.length) setGalleryError(errs.join(" Â· "));
      if (good.length) setGallery(prev => [...prev, ...good]);
    }).finally(() => setUploadingGallery(false));
    if (galleryRef.current) galleryRef.current.value = "";
  };

  const removeGalleryImage = (idx: number) => setGallery(prev => prev.filter((_, i) => i !== idx));

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerError("");
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setBannerError(`Banner image must be under ${MAX_IMAGE_MB}MB.`); return; }
    setUploadingBanner(true);
    apiUploadFile(file, "events/banner").then(r => {
      if (r.data) set("bannerUrl", r.data);
      else setBannerError(r.error?.message ?? "Upload failed.");
    }).finally(() => { setUploadingBanner(false); if (bannerRef.current) bannerRef.current.value = ""; });
  };


  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.venue.trim()) e.venue = "Required";
    if (!form.eventStartDate) e.eventStartDate = "Required";
    if (!form.openDate) e.openDate = "Required";
    if (!form.closeDate) e.closeDate = "Required";
    if (form.eventEndDate && form.eventStartDate && form.eventEndDate < form.eventStartDate)
      e.eventEndDate = "Must be on or after start date";
    if (form.closeDate && form.eventStartDate && form.closeDate >= form.eventStartDate)
      e.closeDate = "Must be before event start date";
    if (form.openDate && form.closeDate && form.openDate >= form.closeDate)
      e.openDate = "Must be before close date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleDeleteEvent = async () => {
    if (!eventId || isNew) return;
    setSaving(true);
    const r = await apiDeleteEvent(eventId);
    setSaving(false);
    if (r.error) { setApiError(r.error.message); return; }
    navigate("/admin/events");
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setApiError("");
    try {
      const payload = { ...form, galleryUrls: gallery, programs };
      if (isNew) {
        const r = await apiCreateEvent(payload);
        if (r.error) { setApiError(r.error.message); return; }
        // Persist any programs that were added locally before the event was saved.
        // Each program is saved individually — stop and surface the error if any fail.
        for (const prog of programs) {
          const { id: _id, currentParticipants: _cp, participantSeeds: _ps, ...progPayload } = prog;
          void _id; void _cp; void _ps;
          const pr = await apiAddProgram(r.data!.id, progPayload);
          if (pr.error) {
            setApiError(`Event created but failed to save program "${prog.name}": ${pr.error.message}`);
            return;
          }
        }
        navigate("/admin/events");
      } else {
        const r = await apiUpdateEvent(eventId!, payload);
        if (r.error) { setApiError(r.error.message); return; }
        setEvent(r.data!);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const status = event ? getEventStatus(event) : undefined;

  if (loading) return <PageLoader label="Loading event…" />;
  if (!isNew && !event && !loading) return (
    <div className="py-20 text-center opacity-40 text-sm">Event not found.</div>
  );

  return (
    <div>
      {/* ── Sticky Header ── */}
      <div className="sticky-header px-2 md:px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/admin/events")} className="btn-back">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h1 className="font-bold text-2xl">
                {isNew ? "Create New Event" : event?.name || "Event"}
              </h1>
              {status && <div className="mt-1"><StatusBadge status={status} /></div>}
            </div>
          </div>
          <div className="flex gap-3">
            {!isNew && !editing && (
              <>
                <button onClick={() => setDeleteConfirmOpen(true)} disabled={saving}
                  className="btn-outline flex items-center gap-2 px-5 py-2.5 text-sm font-medium"
                  style={{ color: "var(--badge-closed-text)", borderColor: "var(--badge-closed-text)" }}>
                  <Trash2 className="h-4 w-4" /> Delete Event
                </button>
                <button onClick={() => setEditing(true)}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                  <Edit2 className="h-4 w-4" /> Edit Event
                </button>
              </>
            )}
            {editing && (
              <>
                {!isNew && (
                  <button onClick={() => setEditing(false)}
                    className="btn-outline flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                )}
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Event"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── API Error ── */}
      {apiError && (
        <div className="mb-6 px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)", border: "1px solid var(--badge-closed-text)" }}>
          {apiError}
        </div>
      )}

      {/* ── Event Details ── */}
      <div className="mb-8 p-8" style={{ border: "1px solid var(--color-table-border)" }}>
        <SectionTitle>Event Details</SectionTitle>
        <div className="grid md:grid-cols-2 gap-6">
          <FF label="Event Name *" error={errors.name}>
            <input className="field-input" value={form.name} onChange={e => set("name", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Venue Name *" error={errors.venue}>
            <input className="field-input" value={form.venue} onChange={e => set("venue", e.target.value)} disabled={!editing} />
          </FF>
          <div className="md:col-span-2">
            <FF label="Venue Address">
              <input className="field-input" value={form.venueAddress} onChange={e => set("venueAddress", e.target.value)} disabled={!editing} />
            </FF>
          </div>
          <FF label="Event Start Date">
            <input type="date" className="field-input" value={form.eventStartDate} onChange={e => set("eventStartDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Event End Date" error={errors.eventEndDate}>
            <input type="date" className="field-input" value={form.eventEndDate} onChange={e => set("eventEndDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Registration Open Date">
            <input type="date" className="field-input" value={form.openDate} onChange={e => set("openDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Registration Close Date" error={errors.closeDate}>
            <input type="date" className="field-input" value={form.closeDate} onChange={e => set("closeDate", e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Max Participants">
            <input type="number" className="field-input" value={form.maxParticipants} onChange={e => set("maxParticipants", +e.target.value)} disabled={!editing} />
          </FF>
          <FF label="Sponsor Information">
            <input className="field-input" value={form.sponsorInfo} onChange={e => set("sponsorInfo", e.target.value)} disabled={!editing} />
          </FF>
          <div className="md:col-span-2">
            <FF label="Description">
              <textarea className="field-input" rows={3} value={form.description} onChange={e => set("description", e.target.value)} disabled={!editing} />
            </FF>
          </div>
          <FF label="Prospectus PDF">
            {editing ? (
              <label className={`flex items-center gap-3 cursor-pointer px-4 py-3 text-sm font-medium transition-colors hover:opacity-80 ${uploadingProspectus ? "opacity-60 pointer-events-none" : ""}`}
                style={{ border: "1px solid var(--color-table-border)", color: "var(--color-body-text)", display: "inline-flex" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {prospectusName || (form.prospectusUrl ? "Prospectus selected" : "Choose PDF file…")}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={uploadingProspectus}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > MAX_PDF_MB * 1024 * 1024) {
                      setApiError(`Prospectus PDF exceeds ${MAX_PDF_MB}MB. Please upload a smaller file or host it and paste a URL.`);
                      return;
                    }
                    setUploadingProspectus(true);
                    const up = await apiUploadFile(file, "events/prospectus");
                    setUploadingProspectus(false);
                    if (up.error) { setApiError(up.error.message); return; }
                    setProspectusName(file.name);
                    set("prospectusUrl", up.data);
                  }}
                />
              </label>
            ) : (
              <>
                {form.prospectusUrl ? (
                  <a
                    href={assetUrl(form.prospectusUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm hover:opacity-80 underline"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {prospectusName || "View Prospectus"}
                  </a>
                ) : (
                  <p className="text-sm opacity-60">No prospectus uploaded</p>
                )}
              </>
            )}
          </FF>
        </div>
      </div>

      {/* ── Sport / Fixture Settings ── */}
      <div className="mb-8 p-8" style={{ border: "1px solid var(--color-table-border)" }}>
        <SectionTitle>Sport & Fixture Settings</SectionTitle>
        <div className="space-y-5">
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <Switch checked={form.isSports} disabled={!editing}
              onCheckedChange={checked => set("isSports", !!checked)} />
            This is a sports event
          </label>

          {form.isSports && (
            <div className="grid sm:grid-cols-2 gap-6">
              <FF label="Sport Type">
                <select
                  className="field-input"
                  value={form.sportType}
                  disabled={!editing}
                  onChange={e => set("sportType", e.target.value)}
                >
                  <optgroup label="Racket Sports">
                    <option value="Badminton">Badminton</option>
                    <option value="Tennis">Tennis</option>
                    <option value="Squash">Squash</option>
                    <option value="Table Tennis">Table Tennis</option>
                    <option value="Pickleball">Pickleball</option>
                  </optgroup>
                  <optgroup label="Team Sports">
                    <option value="Basketball">Basketball</option>
                    <option value="Football">Football</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Rugby">Rugby</option>
                    <option value="Hockey">Hockey</option>
                    <option value="Netball">Netball</option>
                  </optgroup>
                  <optgroup label="Individual Sports">
                    <option value="Swimming">Swimming</option>
                    <option value="Athletics">Athletics</option>
                    <option value="Gymnastics">Gymnastics</option>
                    <option value="Cycling">Cycling</option>
                    <option value="Archery">Archery</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="Other">Other</option>
                  </optgroup>
                </select>
              </FF>
              <FF label="Fixture Management Mode">
                {editing ? (
                  <div className="flex gap-0">
                    {([
                      { value: "internal",     label: "Internal (Built-in)" },
                      { value: "external",     label: "External System" },
                      { value: "not_required", label: "Not Required" },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button" onClick={() => set("fixtureMode", opt.value)}
                        className="px-4 py-2.5 text-sm font-semibold transition-colors"
                        style={{
                          backgroundColor: form.fixtureMode === opt.value ? "var(--color-primary)" : "transparent",
                          color:  form.fixtureMode === opt.value ? "var(--color-hero-text)" : "var(--color-body-text)",
                          border: `1px solid ${form.fixtureMode === opt.value ? "var(--color-primary)" : "var(--color-table-border)"}`,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium capitalize">
                    {form.fixtureMode === "internal" ? "Internal (Built-in)" : form.fixtureMode === "external" ? "External System" : "Not Required"}
                  </p>
                )}
              </FF>
            </div>
          )}
        </div>
      </div>

      {/* ── Banner ── */}
      <div className="mb-8 p-8" style={{ border: "1px solid var(--color-table-border)" }}>
        <SectionTitle>Event Banner</SectionTitle>
        <p className="text-xs opacity-60 mb-4">This image is shown as the hero background on the event page (JPG, PNG, WEBP · max {MAX_IMAGE_MB}MB)</p>
        {editing && (
          <>
            <label className={`inline-flex items-center gap-2 btn-outline px-5 py-2.5 text-sm font-medium cursor-pointer mb-3 ${uploadingBanner ? "opacity-60 pointer-events-none" : ""}`}>
              <Image className="h-4 w-4" /> {uploadingBanner ? "Uploading\u2026" : form.bannerUrl ? "Replace Banner" : "Upload Banner"}
              <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerUpload} />
            </label>
            {bannerError && <p className="text-xs mb-3" style={{ color: "var(--badge-open-text)" }}>{bannerError}</p>}
          </>
        )}
        {form.bannerUrl ? (
          <div className="relative group" style={{ maxWidth: 640 }}>
            <img src={assetUrl(form.bannerUrl)} alt="Event banner" className="w-full object-cover" style={{ maxHeight: 220, border: "1px solid var(--color-table-border)" }} />
            {editing && (
              <button onClick={() => { set("bannerUrl", ""); setBannerError(""); }}
                className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm opacity-40">No banner uploaded. A default banner will be used.</p>
        )}
      </div>

      {/* ── Gallery ── */}
      <div className="mb-8 p-8" style={{ border: "1px solid var(--color-table-border)" }}>
        <SectionTitle>Event Gallery</SectionTitle>
        <p className="text-xs opacity-60 mb-4">Upload multiple images (JPG, PNG, WEBP · max {MAX_IMAGE_MB}MB each)</p>
        {editing && (
          <>
            <label className={`inline-flex items-center gap-2 btn-outline px-5 py-2.5 text-sm font-medium cursor-pointer mb-3 ${uploadingGallery ? "opacity-60 pointer-events-none" : ""}`}>
              <Image className="h-4 w-4" /> {uploadingGallery ? "Uploadingâ€¦" : "Upload Images"}
              <input ref={galleryRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleGalleryUpload} />
            </label>
            {galleryError && <p className="text-xs mb-3" style={{ color: "var(--badge-open-text)" }}>{galleryError}</p>}
          </>
        )}
        {gallery.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {gallery.map((url, i) => (
              <div key={i} className="relative group aspect-video overflow-hidden" style={{ border: "1px solid var(--color-table-border)" }}>
                <img src={assetUrl(url)} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
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

      {/* ── Programs ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <SectionTitle>Programs</SectionTitle>
          <button onClick={() => { setEditingProgram(null); setProgramModalOpen(true); }}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Add Program
          </button>
        </div>

        {isNew && programs.length === 0 && (
          <div className="p-5 text-sm opacity-60 text-center" style={{ border: "1px dashed var(--color-table-border)" }}>
            Save the event first, then add programs — or add programs now and save everything together.
          </div>
        )}

        {programs.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
              <table className="trs-table">
                <thead>
                  <tr>
                    <th>Program Name</th><th>Format</th><th>Age</th><th>Gender</th>
                    <th>Fee</th><th>Min / Max</th><th>Filled</th><th>Actions</th>
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
                          <div className="h-1 transition-all" style={{
                            width: `${Math.min(100, (prog.currentParticipants / prog.maxParticipants) * 100)}%`,
                            backgroundColor: prog.currentParticipants >= prog.maxParticipants ? "var(--badge-open-text)" : "var(--color-primary)",
                          }} />
                        </div>
                      </td>
                      <td>
                        <div className="relative">
                          <button
                            onClick={(e) =>
                              setOpenAction(openAction?.prog.id === prog.id ? null : { prog, anchorEl: e.currentTarget })
                            }
                            className="p-2 hover:opacity-70" style={{ color: "var(--color-primary)" }}>
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {programs.map(prog => (
                <div key={prog.id} className="p-5" style={{ border: "1px solid var(--color-table-border)" }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{prog.name}</p>
                      <p className="text-xs opacity-60">{prog.type} · {prog.gender} · {prog.minAge}–{prog.maxAge}yrs</p>
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) =>
                          setOpenAction(openAction?.prog.id === prog.id ? null : { prog, anchorEl: e.currentTarget })
                        }
                        className="p-1.5 opacity-50 hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold" style={{ color: "var(--color-primary)" }}>{prog.fee > 0 ? `$${prog.fee.toFixed(2)}` : "Free"}</span>
                    <span className="text-xs opacity-60">{prog.currentParticipants}/{prog.maxParticipants} filled</span>
                  </div>
                </div>
              ))}
            </div>

            <ActionDropdownPortal
              open={!!openAction}
              anchorEl={openAction?.anchorEl ?? null}
              onClose={() => setOpenAction(null)}
            >
              <button onClick={() => { if (!openAction) return; setEditingProgram(openAction.prog); setProgramModalOpen(true); setOpenAction(null); }}>
                <Edit2 className="h-4 w-4" /> Edit Program
              </button>
              {!isNew && (
                <button onClick={() => { if (!openAction) return; setSeedingProgramId(openAction.prog.id); setSeedingOpen(true); setOpenAction(null); }}>
                  <Scissors className="h-4 w-4" /> Seeding
                </button>
              )}
              <button onClick={() => { if (!openAction) return; navigate(`/admin/registrations?event=${eventId}&program=${openAction.prog.id}`); setOpenAction(null); }}>
                <Users className="h-4 w-4" /> Registrations
              </button>
            </ActionDropdownPortal>
          </>
        )}
      </div>

      <ProgramModal
        open={programModalOpen}
        onClose={() => { setProgramModalOpen(false); setEditingProgram(null); }}
        onSave={async (savedProgram: Program) => {
          if (!isNew && eventId && eventId !== "new") {
            if (editingProgram) {
              const r = await apiUpdateProgram(eventId, savedProgram.id, savedProgram);
              if (r.data) setPrograms(prev => prev.map(p => p.id === r.data!.id ? r.data! : p));
            } else {
              const { id: _id, currentParticipants: _cp, participantSeeds: _ps, ...payload } = savedProgram;
              void _id; void _cp; void _ps;
              const r = await apiAddProgram(eventId, payload);
              if (r.data) setPrograms(prev => [...prev, r.data!]);
            }
          } else {
            // New event — manage locally until event is saved
            if (editingProgram) {
              setPrograms(prev => prev.map(p => p.id === savedProgram.id ? savedProgram : p));
            } else {
              setPrograms(prev => [...prev, {
                ...savedProgram,
                id: `prog-temp-${Date.now().toString(36)}`,
                currentParticipants: 0,
                participantSeeds: [],
              }]);
            }
          }
          setProgramModalOpen(false);
          setEditingProgram(null);
        }}
        program={editingProgram}
        isBadminton={isBadminton}
        isRacketSport={isRacketSport}
        isTeamSport={isTeamSport}
        sportType={form.sportType}
      />
      {/* SeedingModal only mounts with a real saved eventId — isNew guard above prevents opening */}
      <SeedingModal open={seedingOpen} onClose={() => setSeedingOpen(false)} eventId={eventId ?? ""} programId={seedingProgramId} />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Event"
        description="Delete this event permanently? This cannot be undone."
        confirmLabel="Delete Event"
        loading={saving}
        destructive
        onConfirm={handleDeleteEvent}
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