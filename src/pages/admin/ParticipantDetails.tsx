/**
 * ParticipantDetails.tsx
 *
 * Supports two modes determined by URL params:
 *
 * MODE A — Single registration  (from Registrations list → "View Participants")
 *   Route:  /admin/registrations/:regId/participants
 *   Fetches: GET /api/registrations/:regId
 *   Shows:  all groups/participants for that one registration
 *
 * MODE B — Program aggregate  (from EventEdit program row → "View Participants")
 *   Route:  /admin/registrations/participants?eventId=X&programId=Y
 *   Fetches: GET /api/registrations?eventId=X&programId=Y&pageSize=500
 *   Shows:  all groups/participants across every registration for that program
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, FileDown, User, Users,
  Search, X, ChevronDown, ChevronUp, Filter, Loader2,
} from "lucide-react";
import { apiGetRegistration, apiGetRegistrations, assetUrl } from "@/lib/api";
import type { Registration, RegistrationParticipant, ParticipantGroup } from "@/types/registration";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

function exportGroupCsv(group: ParticipantGroup, regId: string) {
  const headers = [
    "Registration ID", "Contact Name", "Name", "DOB", "Gender", "Nationality", "Club / School",
    "Email", "Contact", "SBA ID", "T-Shirt", "Guardian", "Guardian Contact", "Remark",
    "Document",
    ...Object.keys(group.participants[0]?.customFieldValues ?? {}),
  ];
  const rows = group.participants.map(p => [
    regId, group.registrationId ?? regId,
    p.fullName, p.dob, p.gender, p.nationality, p.clubSchoolCompany,
    p.email ?? "", p.contactNumber ?? "", p.sbaId ?? "",
    p.tshirtSize ?? "", p.guardianName ?? "", p.guardianContact ?? "", p.remark ?? "",
    p.documentUrl ? assetUrl(p.documentUrl) : "",
    ...Object.values(p.customFieldValues ?? {}),
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `reg-${regId}-${group.programName.replace(/[^a-z0-9]/gi, "-")}.csv`;
  a.click();
}

function exportAllCsv(groups: ParticipantGroup[], filename: string) {
  const allRows: string[][] = [];
  const headers = [
    "Registration ID", "Program", "Group ID", "Name", "DOB", "Gender", "Nationality", "Club / School",
    "Email", "Contact", "SBA ID", "T-Shirt", "Guardian", "Guardian Contact", "Remark", "Document",
  ];
  groups.forEach(group => {
    group.participants.forEach(p => {
      const customCols = Object.entries(p.customFieldValues ?? {}).map(([, v]) => v);
      allRows.push([
        group.registrationId ?? "", group.programName, group.id,
        p.fullName, p.dob, p.gender, p.nationality, p.clubSchoolCompany,
        p.email ?? "", p.contactNumber ?? "", p.sbaId ?? "",
        p.tshirtSize ?? "", p.guardianName ?? "", p.guardianContact ?? "", p.remark ?? "",
        p.documentUrl ? assetUrl(p.documentUrl) : "",
        ...customCols,
      ]);
    });
  });
  const csv = [headers, ...allRows]
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ParticipantCard({ p, customFieldKeys }: {
  p: RegistrationParticipant;
  customFieldKeys: string[];
}) {
  const [open, setOpen] = useState(false);
  const hasExtra = !!(p.guardianName || p.remark || p.nationality || customFieldKeys.length > 0);

  return (
    <div style={{ border: "1px solid var(--color-table-border)" }}>
      <div className="grid gap-3 px-4 py-3 text-sm"
        style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}>
        <div>
          <p className="font-semibold leading-tight">{p.fullName}</p>
          {p.sbaId && <p className="font-mono text-xs opacity-60 mt-0.5">{p.sbaId}</p>}
        </div>
        <div className="text-xs opacity-70">
          <p>{p.dob ? fmt(p.dob) : "—"}</p>
          <p className="mt-0.5">{p.gender || "—"}</p>
        </div>
        <div className="text-xs opacity-70 truncate">
          <p>{p.clubSchoolCompany || "—"}</p>
          {p.tshirtSize && <p className="mt-0.5 opacity-60">👕 {p.tshirtSize}</p>}
        </div>
        <div className="text-xs opacity-70">
          <p>{p.email || "—"}</p>
          <p className="mt-0.5">{p.contactNumber || "—"}</p>
        </div>
        <div className="flex items-start gap-2">
          {p.documentUrl && (
            <a href={assetUrl(p.documentUrl)} target="_blank" rel="noopener noreferrer" download
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1"
              style={{ border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}
              title="Download document">
              <FileDown className="h-3.5 w-3.5" />
            </a>
          )}
          {hasExtra && (
            <button onClick={() => setOpen(o => !o)}
              className="inline-flex items-center gap-1 text-xs opacity-50 hover:opacity-80 px-2 py-1"
              style={{ border: "1px solid var(--color-table-border)" }}
              title={open ? "Collapse" : "Expand details"}>
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {open && hasExtra && (
        <div className="px-4 pb-3 pt-0"
          style={{ borderTop: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs pt-3">
            {p.nationality && (
              <span>
                <span className="opacity-50 font-semibold uppercase tracking-wide mr-1">Nationality</span>
                {p.nationality}
              </span>
            )}
            {p.guardianName && (
              <span>
                <span className="opacity-50 font-semibold uppercase tracking-wide mr-1">Guardian</span>
                {p.guardianName}{p.guardianContact ? ` · ${p.guardianContact}` : ""}
              </span>
            )}
            {p.remark && (
              <span>
                <span className="opacity-50 font-semibold uppercase tracking-wide mr-1">Remark</span>
                {p.remark}
              </span>
            )}
            {customFieldKeys.map(label => (
              <span key={label}>
                <span className="opacity-50 font-semibold uppercase tracking-wide mr-1">{label}</span>
                {p.customFieldValues?.[label] || <span className="opacity-30">—</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupSection({ group, search, showRegId }: {
  group: ParticipantGroup;
  search: string;
  showRegId: boolean;
}) {
  const q = search.trim().toLowerCase();
  const participants = q
    ? group.participants.filter(p =>
        p.fullName.toLowerCase().includes(q) ||
        (p.sbaId ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.clubSchoolCompany ?? "").toLowerCase().includes(q)
      )
    : group.participants;

  const customFieldKeys = useMemo(() =>
    Array.from(new Set(group.participants.flatMap(p => Object.keys(p.customFieldValues ?? {})))),
    [group.participants]
  );

  if (participants.length === 0 && q) return null;

  const isDoubles = group.participants.length === 2;
  const isTeam    = group.participants.length > 2;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 py-3 mb-1"
        style={{ backgroundColor: "var(--color-row-hover)", border: "1px solid var(--color-table-border)" }}>
        <div className="flex items-center gap-3">
          {isTeam || isDoubles
            ? <Users className="h-4 w-4 opacity-40 flex-shrink-0" />
            : <User  className="h-4 w-4 opacity-40 flex-shrink-0" />}
          <div>
            <p className="font-semibold text-sm">{group.programName}</p>
            <p className="text-xs opacity-50 font-mono">
              {group.id}
              {showRegId && group.registrationId && (
                <span className="ml-2 opacity-60">· Reg {group.registrationId}</span>
              )}
            </p>
          </div>
          <span className="text-xs px-2 py-0.5 font-medium"
            style={{
              backgroundColor: group.groupStatus === "Confirmed" ? "var(--badge-open-bg)" : "var(--color-table-border)",
              color:           group.groupStatus === "Confirmed" ? "var(--badge-open-text)" : "var(--color-body-text)",
            }}>
            {group.groupStatus}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm" style={{ color: "var(--color-primary)" }}>
            ${group.fee.toFixed(2)}
          </span>
          <button onClick={() => exportGroupCsv(group, group.registrationId ?? group.id)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5"
            style={{ border: "1px solid var(--color-table-border)" }}
            title="Export this group to CSV">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide opacity-50"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
          borderLeft: "1px solid var(--color-table-border)",
          borderRight: "1px solid var(--color-table-border)",
        }}>
        <span>Participant / SBA ID</span>
        <span>DOB / Gender</span>
        <span>Club / T-Shirt</span>
        <span>Contact</span>
        <span>Doc</span>
      </div>

      <div className="space-y-px">
        {participants.map(p => (
          <ParticipantCard key={p.id} p={p} customFieldKeys={customFieldKeys} />
        ))}
      </div>

      {participants.length === 0 && (
        <p className="text-sm opacity-40 px-4 py-6 text-center"
          style={{ border: "1px solid var(--color-table-border)" }}>
          No participants match the search.
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ParticipantDetails() {
  const { regId }      = useParams<{ regId: string }>();
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  // Mode B params (program aggregate)
  const qEventId   = searchParams.get("eventId")   ?? "";
  const qProgramId = searchParams.get("programId") ?? "";

  // Mode A = regId in URL path; Mode B = eventId+programId in query string
  const isProgramMode = !regId && !!qEventId && !!qProgramId;

  // --- Shared state ---
  const [groups,   setGroups]   = useState<ParticipantGroup[]>([]);
  const [heading,  setHeading]  = useState("");
  const [subtext,  setSubtext]  = useState("");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [search,   setSearch]   = useState("");
  const [progFilter, setProgFilter] = useState("");

  // ── Mode A: single registration ──────────────────────────────────────────
  useEffect(() => {
    if (!regId) return;
    setLoading(true);
    apiGetRegistration(regId).then(r => {
      if (r.data) {
        const reg = r.data;
        setGroups(reg.groups.map(g => ({ ...g, registrationId: reg.id })));
        setHeading("Participant Details");
        setSubtext(`${reg.id} · ${reg.eventName} · ${reg.contactName} · ${reg.contactEmail}`);
      } else {
        setError(r.error?.message ?? "Failed to load registration.");
      }
    }).finally(() => setLoading(false));
  }, [regId]);

  // ── Mode B: program aggregate ─────────────────────────────────────────────
  useEffect(() => {
    if (!isProgramMode) return;
    setLoading(true);
    // Fetch up to 500 registrations for this program — sufficient for any real tournament
    apiGetRegistrations(
      { eventId: qEventId, programId: qProgramId },
      { page: 1, pageSize: 500 },
    ).then(r => {
      if (r.data) {
        // Flatten all groups from all registrations, tagging each with its registrationId
        const allGroups = r.data.items.flatMap(reg =>
          reg.groups
            .filter(g => !qProgramId || g.programId === qProgramId)
            .map(g => ({ ...g, registrationId: reg.id }))
        );
        setGroups(allGroups);
        const programName = allGroups[0]?.programName ?? "Program";
        const total = allGroups.reduce((s, g) => s + g.participants.length, 0);
        setHeading(programName);
        setSubtext(`${allGroups.length} entr${allGroups.length !== 1 ? "ies" : "y"} · ${total} participant${total !== 1 ? "s" : ""}`);
      } else {
        setError(r.error?.message ?? "Failed to load participants.");
      }
    }).finally(() => setLoading(false));
  }, [isProgramMode, qEventId, qProgramId]);

  // Unique programs for filter dropdown (only meaningful in single-reg mode with multiple programs)
  const programs = useMemo(() =>
    Array.from(new Map(groups.map(g => [g.programId, g.programName])).entries()),
    [groups]
  );

  const visibleGroups = useMemo(() =>
    groups.filter(g => !progFilter || g.programId === progFilter),
    [groups, progFilter]
  );

  const totalParticipants = useMemo(() =>
    visibleGroups.reduce((s, g) => s + g.participants.length, 0),
    [visibleGroups]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-2 opacity-40 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
    </div>
  );

  if (error) return (
    <div className="p-10 text-center">
      <p className="text-sm opacity-60">{error}</p>
      <button onClick={() => navigate(-1)} className="btn-outline mt-4 px-4 py-2 text-sm">
        Go Back
      </button>
    </div>
  );

  const exportFilename = isProgramMode
    ? `program-${qProgramId}-participants.csv`
    : `registration-${regId}-participants.csv`;

  return (
    <div className="p-6 md:p-10 max-w-screen-xl mx-auto">

      {/* ── Back + header ── */}
      <div className="flex flex-wrap items-start gap-4 mb-8">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100 mt-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-2xl">{heading}</h1>
          <p className="mt-1 text-xs opacity-60">{subtext}</p>
          {!isProgramMode && (
            <p className="text-xs opacity-50 mt-0.5">
              {groups.length} program{groups.length !== 1 ? "s" : ""} · {totalParticipants} participant{totalParticipants !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => exportAllCsv(visibleGroups, exportFilename)}
          className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
          <Download className="h-4 w-4" /> Export All CSV
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Program filter — only shown in single-reg mode when there are multiple programs */}
        {!isProgramMode && programs.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 opacity-40" />
            <select className="field-input min-w-[200px]"
              value={progFilter}
              onChange={e => setProgFilter(e.target.value)}>
              <option value="">All programs</option>
              {programs.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <input className="field-input pr-8 w-full"
            placeholder="Search name, SBA ID, email, club…"
            value={search}
            onChange={e => setSearch(e.target.value)} />
          {search
            ? <button onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">
                <X className="h-3.5 w-3.5" />
              </button>
            : <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-40 pointer-events-none" />}
        </div>
      </div>

      {/* ── Groups ── */}
      {visibleGroups.length === 0 ? (
        <p className="text-sm opacity-40 text-center py-16">No participants found.</p>
      ) : (
        visibleGroups.map(group => (
          <GroupSection
            key={`${group.registrationId}-${group.id}`}
            group={group}
            search={search}
            showRegId={isProgramMode}
          />
        ))
      )}
    </div>
  );
}