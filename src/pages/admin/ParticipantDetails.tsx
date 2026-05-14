/**
 * ParticipantDetails.tsx
 *
 * Accessible from:
 *   /admin/participants                                     — standalone (sidebar menu)
 *   /admin/registrations/participants?eventId=X&programId=Y — from program row in EventEdit
 *   /admin/registrations/:regId/participants                — from registration row
 *
 * All three entry points show the same full filter panel.
 * Route params / query params only pre-fill the relevant filter fields.
 *
 * NOTE: Payment amounts are intentionally NOT shown in this module.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MoreVertical, Eye, Download, Loader2, Save, Search,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import ActionDropdownPortal from "@/components/ui/ActionDropdownPortal";
import {
  apiGetRegistration, apiGetRegistrations,
  apiUpdateParticipant, apiGetEvents, assetUrl,
} from "@/lib/api";
import type { RegistrationParticipant, ParticipantGroup, Registration } from "@/types/registration";
import type { TournamentEvent } from "@/types/config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParticipantRow {
  participant:    RegistrationParticipant;
  group:          ParticipantGroup;
  registration:   Registration;
  eventName:      string;
  programName:    string;
  registrationId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d
      : dt.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

/** Matches Registrations.tsx FG helper exactly */
function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 opacity-60">{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, [string, string]> = {
    Confirmed: ["var(--badge-open-bg)",   "var(--badge-open-text)"],
    Pending:   ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    Cancelled: ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
  };
  const [bg, color] = m[status] ?? ["var(--color-row-hover)", "var(--color-body-text)"];
  return (
    <span className="inline-flex px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: bg, color }}>
      {status}
    </span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAYS  = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEARS = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));

// ── Detail / Edit Modal ───────────────────────────────────────────────────────

interface DetailModalProps {
  row:     ParticipantRow;
  onClose: () => void;
  onSaved: (updated: RegistrationParticipant) => void;
}

function DetailModal({ row, onClose, onSaved }: DetailModalProps) {
  const p = row.participant;

  const [dobYear, dobMonth, dobDay] = useMemo(() => {
    if (!p.dob) return ["", "", ""];
    const parts = p.dob.split("-");
    if (parts.length !== 3) return ["", "", ""];
    return [parts[0], MONTHS[parseInt(parts[1], 10) - 1] ?? "", String(parseInt(parts[2], 10))];
  }, [p.dob]);

  const [form, setForm] = useState({
    fullName:          p.fullName,
    dobDay,  dobMonth,  dobYear,
    gender:            p.gender            ?? "",
    nationality:       p.nationality       ?? "",
    clubSchoolCompany: p.clubSchoolCompany  ?? "",
    email:             p.email             ?? "",
    contactNumber:     p.contactNumber     ?? "",
    tshirtSize:        p.tshirtSize        ?? "",
    sbaId:             p.sbaId             ?? "",
    guardianName:      p.guardianName      ?? "",
    guardianContact:   p.guardianContact   ?? "",
    remark:            p.remark            ?? "",
    customFieldValues: { ...(p.customFieldValues ?? {}) },
  });

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const customFieldKeys = Object.keys(p.customFieldValues ?? {});

  const handleSave = async () => {
    if (!form.fullName.trim()) return;
    setSaveError(""); setSaving(true);
    try {
      const monthIdx = MONTHS.indexOf(form.dobMonth);
      const dob = form.dobYear && form.dobMonth && form.dobDay
        ? `${form.dobYear}-${String(monthIdx + 1).padStart(2, "0")}-${String(form.dobDay).padStart(2, "0")}`
        : "";

      const r = await apiUpdateParticipant(row.registrationId, p.id, {
        fullName:          form.fullName          || undefined,
        dob:               dob                   || undefined,
        gender:            form.gender            || undefined,
        nationality:       form.nationality       || undefined,
        clubSchoolCompany: form.clubSchoolCompany || undefined,
        email:             form.email             || undefined,
        contactNumber:     form.contactNumber     || undefined,
        tshirtSize:        form.tshirtSize        || undefined,
        sbaId:             form.sbaId             || undefined,
        guardianName:      form.guardianName      || undefined,
        guardianContact:   form.guardianContact   || undefined,
        remark:            form.remark            || undefined,
        customFieldValues: customFieldKeys.length ? form.customFieldValues : undefined,
      });
      if (r.error) { setSaveError(r.error.message); return; }
      onSaved({ ...p, ...form, dob, customFieldValues: { ...form.customFieldValues } });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl p-0"
        style={{
          backgroundColor: "var(--color-page-bg)",
          border: "1px solid var(--color-table-border)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}>
        <DialogHeader className="p-8 pb-5"
          style={{ borderBottom: "1px solid var(--color-table-border)" }}>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="font-bold text-xl">{p.fullName}</DialogTitle>
              <p className="text-xs opacity-50 mt-1">
                {row.eventName} · {row.programName} · Reg {row.registrationId}
              </p>
            </div>
            <StatusBadge status={row.group.groupStatus} />
          </div>
          {/*
            TODO (future — audit trail):
            Show change history per field: FieldName, OldValue, NewValue,
            ModifiedBy (admin user), ModifiedAt timestamp.
            Backend: each PATCH writes to ParticipantAuditLog table.
          */}
        </DialogHeader>

        <div className="p-8 space-y-5">
          {saveError && (
            <div className="p-3 text-sm"
              style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)" }}>
              {saveError}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <FG label="Full Name *">
              <input className="field-input" value={form.fullName}
                onChange={e => set("fullName", e.target.value)} />
            </FG>
            <FG label="Gender">
              <select className="field-input" value={form.gender}
                onChange={e => set("gender", e.target.value)}>
                <option value="">—</option>
                <option>Male</option><option>Female</option><option>Non-binary</option>
              </select>
            </FG>
          </div>

          <FG label="Date of Birth">
            <div className="grid grid-cols-3 gap-2">
              <select className="field-input" value={form.dobDay}
                onChange={e => set("dobDay", e.target.value)}>
                <option value="">Day</option>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
              <select className="field-input" value={form.dobMonth}
                onChange={e => set("dobMonth", e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
              <select className="field-input" value={form.dobYear}
                onChange={e => set("dobYear", e.target.value)}>
                <option value="">Year</option>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </FG>

          <div className="grid sm:grid-cols-2 gap-4">
            <FG label="Nationality">
              <input className="field-input" value={form.nationality}
                onChange={e => set("nationality", e.target.value)} />
            </FG>
            <FG label="Club / School / Company">
              <input className="field-input" value={form.clubSchoolCompany}
                onChange={e => set("clubSchoolCompany", e.target.value)} />
            </FG>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FG label="Email">
              <input type="email" className="field-input" value={form.email}
                onChange={e => set("email", e.target.value)} />
            </FG>
            <FG label="Contact Number">
              <input className="field-input" value={form.contactNumber}
                onChange={e => set("contactNumber", e.target.value)} />
            </FG>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FG label="SBA ID">
              <input className="field-input font-mono" value={form.sbaId}
                onChange={e => set("sbaId", e.target.value)} />
            </FG>
            <FG label="T-Shirt Size">
              <select className="field-input" value={form.tshirtSize}
                onChange={e => set("tshirtSize", e.target.value)}>
                <option value="">—</option>
                {["XS","S","M","L","XL","2XL","3XL"].map(s => <option key={s}>{s}</option>)}
              </select>
            </FG>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FG label="Guardian Name">
              <input className="field-input" value={form.guardianName}
                onChange={e => set("guardianName", e.target.value)} />
            </FG>
            <FG label="Guardian Contact">
              <input className="field-input" value={form.guardianContact}
                onChange={e => set("guardianContact", e.target.value)} />
            </FG>
          </div>

          <FG label="Remark">
            <textarea className="field-input" rows={2} value={form.remark}
              onChange={e => set("remark", e.target.value)} />
          </FG>

          {customFieldKeys.length > 0 && (
            <div>
              <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-3">
                Custom Fields
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {customFieldKeys.map(label => (
                  <FG key={label} label={label}>
                    <input className="field-input"
                      value={form.customFieldValues[label] ?? ""}
                      onChange={e => set("customFieldValues",
                        { ...form.customFieldValues, [label]: e.target.value }
                      )} />
                  </FG>
                ))}
              </div>
            </div>
          )}

          {p.documentUrl && (
            <div className="p-4" style={{ border: "1px solid var(--color-table-border)" }}>
              <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">
                Uploaded Document
              </p>
              <a href={assetUrl(p.documentUrl)} target="_blank" rel="noopener noreferrer" download
                className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80"
                style={{ color: "var(--color-primary)" }}>
                <Download className="h-4 w-4" /> Download uploaded file
              </a>
            </div>
          )}
        </div>

        <DialogFooter className="p-8 pt-0"
          style={{ borderTop: "1px solid var(--color-table-border)" }}>
          <button onClick={onClose}
            className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
          <button onClick={handleSave}
            disabled={saving || !form.fullName.trim()}
            className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40
                       flex items-center gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main page
// ═════════════════════════════════════════════════════════════════════════════

export default function ParticipantDetails() {
  const { regId }      = useParams<{ regId: string }>();
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  // Pre-fill from route / query params — all three entry points use the same
  // full filter panel; route params just seed the initial field values.
  const initEventId   = searchParams.get("eventId")   ?? "";
  const initProgramId = searchParams.get("programId") ?? "";
  // regId from the URL path (:regId) seeds the Reg No. filter
  const initRegId     = regId ?? searchParams.get("regId") ?? "";

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filterSearch,  setFilterSearch]  = useState("");
  const [filterEvent,   setFilterEvent]   = useState(initEventId);
  const [filterProgram, setFilterProgram] = useState(initProgramId);
  const [filterRegId,   setFilterRegId]   = useState(initRegId);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [rows,    setRows]    = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [events,  setEvents]  = useState<TournamentEvent[]>([]);

  // 3-dot menu
  const [openAction, setOpenAction] = useState<{
    row:         ParticipantRow;
    anchorEl:    HTMLElement;
    participant: RegistrationParticipant;
  } | null>(null);

  // Detail modal
  const [detailRow, setDetailRow] = useState<ParticipantRow | null>(null);

  // ── Load events for dropdown ───────────────────────────────────────────────
  useEffect(() => {
    apiGetEvents().then(r => { if (r.data) setEvents(r.data); });
  }, []);

  // ── Programs for the selected event ───────────────────────────────────────
  const programsForEvent = useMemo(
    () => events.find(e => e.id === filterEvent)?.programs ?? [],
    [events, filterEvent]
  );

  // ── Fetch rows whenever server-side filters change ─────────────────────────
  // filterSearch is client-side only (instant, no API call needed)
  const loadRows = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let regs: Registration[] = [];

      if (filterRegId.trim()) {
        // Fetch a single registration by ID
        const r = await apiGetRegistration(filterRegId.trim());
        if (r.error) { setError(r.error.message); return; }
        regs = [r.data!];
      } else {
        const filters: Record<string, string> = {};
        if (filterEvent)   filters.eventId   = filterEvent;
        if (filterProgram) filters.programId = filterProgram;
        const r = await apiGetRegistrations(filters, { page: 1, pageSize: 500 });
        if (r.error) { setError(r.error.message); return; }
        regs = r.data!.items;
      }

      setRows(
        regs.flatMap(reg =>
          reg.groups.flatMap(g =>
            g.participants.map(p => ({
              participant:    p,
              group:          g,
              registration:   reg,
              eventName:      reg.eventName,
              programName:    g.programName,
              registrationId: reg.id,
            }))
          )
        )
      );
    } finally {
      setLoading(false);
    }
  }, [filterEvent, filterProgram, filterRegId]);

  // Initial load
  useEffect(() => { loadRows(); }, [loadRows]);

  // ── Client-side name/SBA search ────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.participant.fullName.toLowerCase().includes(q) ||
      (r.participant.sbaId ?? "").toLowerCase().includes(q) ||
      r.programName.toLowerCase().includes(q)
    );
  }, [rows, filterSearch]);

  // ── Update row in state after edit ────────────────────────────────────────
  const handleSaved = useCallback((updated: RegistrationParticipant) => {
    setRows(prev => prev.map(r =>
      r.participant.id === updated.id ? { ...r, participant: updated } : r
    ));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Sticky Header — matches Registrations page pattern exactly ── */}
      <div className="sticky-header">
        <div className="admin-page-title">
          <h1>Participant Details</h1>
        </div>
      </div>

      {/* ── Filter Panel — matches Registrations page style exactly ── */}
      <div className="p-4 mb-5"
        style={{
          border: "1px solid var(--color-table-border)",
          backgroundColor: "var(--color-row-hover)",
        }}>
        <div className="flex flex-wrap items-end gap-3">

          <FG label="Search">
            <div className="relative">
              <input className="field-input w-48 pr-8"
                placeholder="Name, SBA ID…"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)} />
              {filterSearch && (
                <button onClick={() => setFilterSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">
                  <Search className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </FG>

          <FG label="Event">
            <select className="field-input w-52" value={filterEvent}
              onChange={e => {
                setFilterEvent(e.target.value);
                setFilterProgram("");
                setFilterRegId("");
              }}>
              <option value="">All Events</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </FG>

          <FG label="Program">
            <select className="field-input w-44" value={filterProgram}
              disabled={!filterEvent}
              onChange={e => { setFilterProgram(e.target.value); setFilterRegId(""); }}>
              <option value="">All Programs</option>
              {programsForEvent.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FG>

          <FG label="Reg No.">
            <input className="field-input w-28"
              placeholder="e.g. 42"
              value={filterRegId}
              onChange={e => {
                setFilterRegId(e.target.value);
                // Clear event/program filters when narrowing by reg ID
                if (e.target.value) { setFilterEvent(""); setFilterProgram(""); }
              }} />
          </FG>

        </div>
      </div>

      {/* ── Row count ── */}
      <p className="text-xs opacity-50 mb-3">
        {loading ? "Loading…" : `${visibleRows.length} participant${visibleRows.length !== 1 ? "s" : ""}${
          rows.length !== visibleRows.length ? ` (filtered from ${rows.length})` : ""}`}
      </p>

      {/* ── Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 opacity-40 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
        </div>
      ) : error ? (
        <div className="py-16 text-center text-sm opacity-60">{error}</div>
      ) : visibleRows.length === 0 ? (
        <div className="py-16 text-center text-sm opacity-40">No participants found.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto"
            style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Reg No.</th>
                  <th>Event</th>
                  <th>Program</th>
                  <th>Participant Name</th>
                  <th>DOB</th>
                  <th>Gender</th>
                  <th>Status</th>
                  <th style={{ width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={`${row.registrationId}-${row.participant.id}`}
                    className="cursor-pointer"
                    onClick={() => setDetailRow(row)}>
                    <td className="font-mono text-xs">{row.registrationId}</td>
                    <td className="text-sm">{row.eventName}</td>
                    <td className="text-sm">{row.programName}</td>
                    <td className="font-semibold text-sm">
                      {row.participant.fullName}
                      {row.participant.sbaId && (
                        <span className="ml-2 font-mono text-xs opacity-40">
                          {row.participant.sbaId}
                        </span>
                      )}
                    </td>
                    <td className="text-sm">{fmtDate(row.participant.dob)}</td>
                    <td className="text-sm">{row.participant.gender || "—"}</td>
                    <td><StatusBadge status={row.group.groupStatus} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => setOpenAction(
                          openAction?.participant.id === row.participant.id ? null
                            : { row, anchorEl: e.currentTarget, participant: row.participant }
                        )}
                        className="p-2 hover:opacity-70"
                        style={{ color: "var(--color-primary)" }}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {visibleRows.map(row => (
              <div key={`${row.registrationId}-${row.participant.id}`}
                className="p-4 cursor-pointer"
                style={{ border: "1px solid var(--color-table-border)" }}
                onClick={() => setDetailRow(row)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{row.participant.fullName}</p>
                    <p className="text-xs opacity-50">{row.programName} · {row.eventName}</p>
                    <p className="text-xs opacity-40 font-mono mt-0.5">Reg {row.registrationId}</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <StatusBadge status={row.group.groupStatus} />
                    <button
                      onClick={e => setOpenAction(
                        openAction?.participant.id === row.participant.id ? null
                          : { row, anchorEl: e.currentTarget, participant: row.participant }
                      )}
                      className="p-1.5 opacity-50">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs opacity-60">
                  <span>DOB: {fmtDate(row.participant.dob)}</span>
                  <span>{row.participant.gender || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 3-dot Menu ── */}
      <ActionDropdownPortal
        open={!!openAction}
        anchorEl={openAction?.anchorEl ?? null}
        onClose={() => setOpenAction(null)}
      >
        {openAction && (
          <>
            <button onClick={() => { setDetailRow(openAction.row); setOpenAction(null); }}>
              <Eye className="h-4 w-4" /> View Detail
            </button>
            <button
              disabled={!openAction.participant.documentUrl}
              onClick={() => {
                const url = openAction.participant.documentUrl;
                if (!url) return;
                const a = document.createElement("a");
                a.href = assetUrl(url);
                a.download = "";
                a.target = "_blank";
                a.click();
                setOpenAction(null);
              }}
              style={{
                opacity: openAction.participant.documentUrl ? 1 : 0.35,
                cursor:  openAction.participant.documentUrl ? "pointer" : "not-allowed",
              }}>
              <Download className="h-4 w-4" /> Download User Upload
            </button>
          </>
        )}
      </ActionDropdownPortal>

      {/* ── Detail / Edit Modal ── */}
      {detailRow && (
        <DetailModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}