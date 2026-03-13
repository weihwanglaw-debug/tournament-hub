/**
 * Registrations.tsx — Registration & Payment Management
 *
 * Primary unit: Registration (one row = one form submission).
 * Each registration can cover multiple programs (multiple ParticipantGroups).
 * One payment receipt per registration covers all programs in that submission.
 *
 * Tabs:
 *   Registration List  — expandable rows showing groups + participants
 *   Payment Log        — per-payment-record view with receipt/refund actions
 *
 * Data access: ALL reads/writes go through @/lib/api — never raw mock imports.
 * MOCK → REAL: swap function bodies in registrationsApi.ts only. This file stays.
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CreditCard, CheckCircle, XCircle, RefreshCw, ChevronUp, ChevronDown,
  ChevronsUpDown, Receipt, MoreVertical, ChevronRight, Users
} from "lucide-react";
import type { TournamentEvent } from "@/types/config";
import type {
  Registration, ParticipantGroup, Payment, PaymentItem,
  Refund, PaymentMethod, PaymentStatus, RegStatus,
} from "@/types/registration";
import { totalFee, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/types/registration";
import {
  apiGetRegistrations, apiGetEvents,
  apiUpdatePayment, apiInitiateRefund, apiGetRefunds,
  apiUpdateRegistrationStatus, apiUpdateGroupStatus,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/TableControls";
import { Switch } from "@/components/ui/switch";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortState<T> = { key: keyof T | null; dir: "asc" | "desc" };
function useSort<T>(data: T[]) {
  const [sort, setSort] = useState<SortState<T>>({ key: null, dir: "asc" });
  const toggle = (key: keyof T) =>
    setSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const sorted = useMemo(() => {
    if (!sort.key) return data;
    return [...data].sort((a, b) => {
      const av = String(a[sort.key!] ?? ""), bv = String(b[sort.key!] ?? "");
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [data, sort]);
  return { sort, toggle, sorted };
}

// ── Badges ────────────────────────────────────────────────────────────────────

function PayBadge({ status }: { status: PaymentStatus }) {
  const label = PAYMENT_STATUS_LABEL[status] ?? status;
  const m: Record<string, [string, string]> = {
    "Success":            ["var(--badge-open-bg)",   "var(--badge-open-text)"],
    "Pending":            ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    "FullyRefunded":      ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
    "PartiallyRefunded":  ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    "Failed":             ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
    "Cancelled":          ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
  };
  const [bg, text] = m[status] ?? m["Pending"];
  return <span className="inline-flex px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: bg, color: text }}>{label}</span>;
}

function RegBadge({ status }: { status: string }) {
  const m: Record<string, [string, string]> = {
    "Confirmed":  ["var(--badge-open-bg)",   "var(--badge-open-text)"],
    "Pending":    ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    "Cancelled":  ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
    "Waitlisted": ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
  };
  const [bg, text] = m[status] ?? m["Pending"];
  return <span className="inline-flex px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: bg, color: text }}>{status}</span>;
}

function MethodIcon({ method }: { method: PaymentMethod }) {
  if (method === "CreditCard") return <CreditCard className="h-3.5 w-3.5 opacity-60" />;
  if (method === "PayNow") return <span className="text-xs font-bold px-1" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>PN</span>;
  return null;
}

function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold mb-1.5 opacity-60">{label}</label>{children}</div>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sum of Success refunds for a payment's items, from the Refund[] store. */
function calcRefunded(refunds: Refund[], items: PaymentItem[]): number {
  return items.reduce((sum, item) => {
    const r = refunds.find(r => r.paymentItemId === item.id && r.refundStatus === "Success");
    return sum + (r?.refundAmount ?? 0);
  }, 0);
}

/** Returns a warning if refunding this per-player item would drop a group below minPlayers. */
function getMinPlayersWarning(
  reg: Registration,
  itemId: string,
  events: TournamentEvent[],
): string | null {
  const item = reg.payment.items.find(i => i.id === itemId);
  if (!item?.participantId) return null;  // per_entry items have no player count
  const group = reg.groups.find(g => g.id === item.participantGroupId);
  if (!group) return null;
  const prog = events.flatMap(e => e.programs).find(p => p.id === group.programId);
  if (!prog) return null;
  const remaining = reg.payment.items.filter(
    i => i.participantGroupId === group.id && i.participantId
      && i.itemStatus !== "Refunded" && i.id !== itemId
  ).length;
  if (remaining < prog.minPlayers)
    return `Removing this player leaves ${remaining} player${remaining !== 1 ? "s" : ""} — below the minimum of ${prog.minPlayers}. Cancel the entire entry instead.`;
  return null;
}

// ── Expanded row ──────────────────────────────────────────────────────────────

function ExpandedRow({ reg, refunds }: { reg: Registration; refunds: Refund[] }) {
  const refunded = calcRefunded(refunds, reg.payment.items);
  return (
    <tr>
      <td colSpan={10} style={{ padding: 0, backgroundColor: "var(--color-row-hover)" }}>
        <div className="px-6 py-4 space-y-4">
          {reg.groups.map(group => (
            <div key={group.id} style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-page-bg)" }}>
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold opacity-30 font-mono">{group.id}</span>
                  <span className="font-semibold text-sm">{group.programName}</span>
                  <RegBadge status={group.groupStatus} />
                </div>
                <span className="font-bold text-sm" style={{ color: "var(--color-primary)" }}>
                  ${group.fee.toFixed(2)}
                </span>
              </div>
              <table className="trs-table">
                <thead>
                  <tr>
                    <th>Participant</th><th>DOB</th><th>Gender</th>
                    <th>Club / School</th><th>SBA ID</th><th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {group.participants.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium text-sm">{p.fullName}</td>
                      <td className="text-xs opacity-60">{p.dob || "—"}</td>
                      <td className="text-xs opacity-60">{p.gender}</td>
                      <td className="text-xs opacity-70">{p.clubSchoolCompany}</td>
                      <td className="font-mono text-xs">{p.sbaId || <span className="opacity-25">—</span>}</td>
                      <td className="text-xs opacity-60">{p.contactNumber || p.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="flex items-center gap-4 text-xs opacity-60 pt-1">
            <span>Receipt: <strong className="font-mono">{reg.payment.receiptNo || "—"}</strong></span>
            <span>·</span>
            <span>Method: {PAYMENT_METHOD_LABEL[reg.payment.method] ?? reg.payment.method}</span>
            <span>·</span>
            <span>Paid: {reg.payment.paidAt ? reg.payment.paidAt.slice(0, 10) : "—"}</span>
            <span>·</span>
            <span>Total: <strong style={{ color: "var(--color-primary)" }}>${totalFee(reg).toFixed(2)}</strong></span>
            {refunded > 0 && (
              <><span>·</span><span style={{ color: "var(--badge-open-text)" }}>Refunded: ${refunded.toFixed(2)}</span></>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminRegistrations() {
  const [urlParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"registrations" | "payments">("registrations");

  // ── Data — loaded via API (MOCK or REAL, same call) ───────────────────────
  const [regs,    setRegs]    = useState<Registration[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [events,  setEvents]  = useState<TournamentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGetRegistrations(undefined, { page: 1, pageSize: 500 }),
      apiGetEvents(),
    ]).then(([regsRes, eventsRes]) => {
      if (regsRes.data)   setRegs(regsRes.data.items);
      if (eventsRes.data) setEvents(eventsRes.data);
      setLoading(false);
    });
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterEvent,   setFilterEvent]   = useState(urlParams.get("event") || "");
  const [filterProgram, setFilterProgram] = useState(urlParams.get("program") || "");
  const [filterReg,     setFilterReg]     = useState("");
  const [filterPay,     setFilterPay]     = useState("");
  const [filterSearch,  setFilterSearch]  = useState("");
  const [page, setPage]     = useState(1);
  const [perPage, setPerPage] = useState(10);

  const programsForEvent = useMemo(() =>
    events.find(e => e.id === filterEvent)?.programs ?? [], [events, filterEvent]);

  const filtered = useMemo(() => regs.filter(r => {
    if (filterEvent   && r.eventId !== filterEvent) return false;
    if (filterProgram && !r.groups.some(g => g.programId === filterProgram)) return false;
    if (filterReg     && r.regStatus !== filterReg) return false;
    if (filterPay     && r.payment.paymentStatus !== filterPay) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!r.contactName.toLowerCase().includes(q)
        && !r.id.toLowerCase().includes(q)
        && !r.groups.some(g => g.namesDisplay.toLowerCase().includes(q) || g.clubDisplay.toLowerCase().includes(q)))
        return false;
    }
    return true;
  }), [regs, filterEvent, filterProgram, filterReg, filterPay, filterSearch]);

  const sorted   = useMemo(() => [...filtered].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [filtered]);
  const total    = sorted.length;
  const totalPgs = Math.max(1, Math.ceil(total / perPage));
  const paged    = sorted.slice((page - 1) * perPage, page * perPage);

  // ── Action dropdown ───────────────────────────────────────────────────────
  const [openAction, setOpenAction] = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openAction) return;
    const h = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) setOpenAction(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openAction]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── Modals ────────────────────────────────────────────────────────────────
  const [markPaidModal,  setMarkPaidModal]  = useState<Registration | null>(null);
  const [cancelModal,    setCancelModal]    = useState<Registration | null>(null);
  const [refundModal,    setRefundModal]    = useState<Registration | null>(null);
  const [receiptModal,   setReceiptModal]   = useState<Registration | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<PaymentMethod>("PayNow");
  const [markPaidRemark, setMarkPaidRemark] = useState("");
  const [cancelReason,   setCancelReason]   = useState("");
  const [refundSel,      setRefundSel]      = useState<Record<string, { checked: boolean; reason: string }>>({});
  const [saving,         setSaving]         = useState(false);

  /** Refresh a single registration + its refunds in local state after a mutation. */
  const refreshReg = async (regId: string) => {
    const [regRes, refundsRes] = await Promise.all([
      apiGetRegistrations({ search: regId }, { page: 1, pageSize: 500 }),
      apiGetRefunds(regId),
    ]);
    if (regRes.data) {
      setRegs(prev => {
        const updated = regRes.data!.items.find(r => r.id === regId);
        return updated ? prev.map(r => r.id === regId ? updated : r) : prev;
      });
    }
    if (refundsRes.data) {
      // Merge new refunds into store (keyed by id to avoid duplicates)
      setRefunds(prev => {
        const merged = [...prev.filter(r => {
          // Remove old refunds for this payment; fresh ones will be added
          const reg = regs.find(reg => reg.id === regId);
          return reg ? r.paymentId !== reg.payment.id : true;
        }), ...refundsRes.data!];
        return merged;
      });
    }
  };

  // ── Mark as Paid ──────────────────────────────────────────────────────────
  const handleMarkPaid = async () => {
    if (!markPaidModal || !markPaidRemark.trim()) return;
    setSaving(true);
    const result = await apiUpdatePayment(markPaidModal.id, {
      paymentStatus: "Success",
      method: markPaidMethod,
    });
    if (result.data) {
      setRegs(prev => prev.map(r => r.id === result.data!.id ? result.data! : r));
      // Also flip reg status → Confirmed
      await apiUpdateRegistrationStatus(markPaidModal.id, "Confirmed");
      setRegs(prev => prev.map(r => r.id === markPaidModal.id
        ? { ...r, regStatus: "Confirmed", groups: r.groups.map(g => ({ ...g, groupStatus: "Confirmed" as RegStatus })) }
        : r));
    }
    setSaving(false);
    setMarkPaidModal(null); setMarkPaidRemark(""); setMarkPaidMethod("PayNow");
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    setSaving(true);
    // Cancel all groups
    for (const group of cancelModal.groups) {
      await apiUpdateGroupStatus(cancelModal.id, group.id, "Cancelled");
    }
    await apiUpdateRegistrationStatus(cancelModal.id, "Cancelled");
    // If was paid, trigger full refund
    if (cancelModal.payment.paymentStatus === "Success") {
      for (const item of cancelModal.payment.items) {
        if (item.itemStatus === "Success") {
          await apiInitiateRefund(cancelModal.id, item.id, item.amount, `Cancelled: ${cancelReason}`, "admin");
        }
      }
    } else {
      await apiUpdatePayment(cancelModal.id, { paymentStatus: "Cancelled" });
    }
    await refreshReg(cancelModal.id);
    setSaving(false);
    setCancelModal(null); setCancelReason("");
  };

  // ── Refund ────────────────────────────────────────────────────────────────
  const handleRefund = async () => {
    if (!refundModal) return;
    setSaving(true);
    for (const [itemId, sel] of Object.entries(refundSel)) {
      if (!sel.checked || !sel.reason.trim()) continue;
      if (getMinPlayersWarning(refundModal, itemId, events)) continue;
      await apiInitiateRefund(refundModal.id, itemId, refundModal.payment.items.find(i => i.id === itemId)!.amount, sel.reason, "admin");
    }
    await refreshReg(refundModal.id);
    setSaving(false);
    setRefundModal(null); setRefundSel({});
  };

  // ── Payment tab ───────────────────────────────────────────────────────────
  const [txnFilterEvent,  setTxnFilterEvent]  = useState("");
  const [txnFilterStatus, setTxnFilterStatus] = useState("");
  const [txnFilterMethod, setTxnFilterMethod] = useState("");
  const [txnPage,    setTxnPage]    = useState(1);
  const [txnPerPage, setTxnPerPage] = useState(10);

  const filteredTxns = useMemo(() => regs.filter(r => {
    if (txnFilterEvent  && !r.eventName.toLowerCase().includes(txnFilterEvent.toLowerCase())) return false;
    if (txnFilterStatus && r.payment.paymentStatus !== txnFilterStatus) return false;
    if (txnFilterMethod && r.payment.method !== txnFilterMethod) return false;
    return true;
  }), [regs, txnFilterEvent, txnFilterStatus, txnFilterMethod]);

  const txnTotal    = filteredTxns.length;
  const txnTotalPgs = Math.max(1, Math.ceil(txnTotal / txnPerPage));
  const pagedTxns   = filteredTxns.slice((txnPage - 1) * txnPerPage, txnPage * txnPerPage);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 opacity-40">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading registrations…
      </div>
    );
  }

  return (
    <div>
      <div className="sticky-header">
        <div className="admin-page-title"><h1>Registrations &amp; Payments</h1></div>
        <div className="tab-bar mb-6">
          {(["registrations", "payments"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}>
              {tab === "registrations" ? `Registration List (${filtered.length})` : "Payment Log"}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ REGISTRATIONS TAB ══════════ */}
      {activeTab === "registrations" && (
        <>
          {/* Filters */}
          <div className="p-4 mb-5" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="flex flex-wrap items-end gap-3">
              <FG label="Search">
                <input className="field-input w-52" placeholder="Name, ID, club…"
                  value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setPage(1); }} />
              </FG>
              <FG label="Event">
                <select className="field-input w-56" value={filterEvent}
                  onChange={e => { setFilterEvent(e.target.value); setFilterProgram(""); setPage(1); }}>
                  <option value="">All Events</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </FG>
              <FG label="Program">
                <select className="field-input w-44" value={filterProgram} disabled={!filterEvent}
                  onChange={e => { setFilterProgram(e.target.value); setPage(1); }}>
                  <option value="">All Programs</option>
                  {programsForEvent.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FG>
              <FG label="Reg. Status">
                <select className="field-input w-36" value={filterReg}
                  onChange={e => { setFilterReg(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Waitlisted">Waitlisted</option>
                </select>
              </FG>
              <FG label="Payment">
                <select className="field-input w-40" value={filterPay}
                  onChange={e => { setFilterPay(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  <option value="Success">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="FullyRefunded">Refunded</option>
                  <option value="PartiallyRefunded">Partially Refunded</option>
                  <option value="Failed">Failed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </FG>
            </div>
          </div>

          <div style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Reg ID</th><th>Contact</th><th>Event</th>
                  <th>Programs</th><th>Reg. Status</th>
                  <th>Payment</th><th>Total</th><th>Submitted</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-10 opacity-40">No registrations found.</td></tr>
                )}
                {paged.map(reg => {
                  const isExpanded   = expanded.has(reg.id);
                  const canPay       = reg.payment.paymentStatus === "Pending" && reg.regStatus !== "Cancelled";
                  const canRefund    = reg.payment.paymentStatus === "Success"  && reg.regStatus !== "Cancelled";
                  const canCancel    = reg.regStatus !== "Cancelled";
                  const programCount = reg.groups.length;
                  const regRefunds   = refunds.filter(r => r.paymentId === reg.payment.id);
                  const refunded     = calcRefunded(regRefunds, reg.payment.items);

                  return (
                    <React.Fragment key={reg.id}>
                      <tr style={reg.regStatus === "Pending" || reg.payment.paymentStatus === "Pending"
                        ? { borderLeft: "3px solid var(--badge-soon-text)" } : undefined}>
                        <td>
                          <button onClick={() => toggleExpand(reg.id)} className="p-1 opacity-40 hover:opacity-80">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="font-mono text-xs">{reg.id}</td>
                        <td>
                          <p className="font-semibold text-sm">{reg.contactName}</p>
                          <p className="text-xs opacity-50">{reg.contactEmail}</p>
                        </td>
                        <td className="text-sm max-w-40"><p className="truncate">{reg.eventName}</p></td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 opacity-30" />
                            <span className="text-sm">{programCount} program{programCount !== 1 ? "s" : ""}</span>
                          </div>
                          <p className="text-xs opacity-50 mt-0.5">{reg.groups.map(g => g.programName).join(", ")}</p>
                        </td>
                        <td><RegBadge status={reg.regStatus} /></td>
                        <td><PayBadge status={reg.payment.paymentStatus} /></td>
                        <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>
                          ${totalFee(reg).toFixed(2)}
                          {refunded > 0 && (
                            <span className="block text-xs font-normal" style={{ color: "var(--badge-open-text)" }}>
                              −${refunded.toFixed(2)} refunded
                            </span>
                          )}
                        </td>
                        <td className="text-xs opacity-60">
                          {new Date(reg.submittedAt).toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td>
                          <div className="relative" ref={openAction === reg.id ? actionRef : undefined}>
                            <button onClick={() => setOpenAction(openAction === reg.id ? null : reg.id)}
                              className="p-2 hover:opacity-70" style={{ color: "var(--color-primary)" }}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openAction === reg.id && (
                              <div className="action-dropdown">
                                <button disabled={!canPay}
                                  onClick={() => { setMarkPaidModal(reg); setOpenAction(null); }}>
                                  <CheckCircle className="h-4 w-4" /> Mark as Paid
                                </button>
                                <button disabled={!canRefund}
                                  onClick={() => { setRefundSel({}); setRefundModal(reg); setOpenAction(null); }}>
                                  <RefreshCw className="h-4 w-4" /> Refund
                                </button>
                                {reg.payment.receiptNo && (
                                  <button onClick={() => { setReceiptModal(reg); setOpenAction(null); }}>
                                    <Receipt className="h-4 w-4" /> View Receipt
                                  </button>
                                )}
                                <button disabled={!canCancel}
                                  onClick={() => { setCancelModal(reg); setOpenAction(null); }}
                                  style={{ color: canCancel ? "var(--badge-closed-text)" : undefined }}>
                                  <XCircle className="h-4 w-4" /> Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && <ExpandedRow reg={reg} refunds={regRefunds} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPgs} perPage={perPage} total={total}
              setPage={setPage} setPerPage={n => { setPerPage(n); setPage(1); }} />
          </div>
        </>
      )}

      {/* ══════════ PAYMENTS TAB ══════════ */}
      {activeTab === "payments" && (
        <>
          <div className="p-4 mb-5" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="flex flex-wrap items-end gap-3">
              <FG label="Event">
                <input className="field-input w-52" placeholder="Search event…"
                  value={txnFilterEvent} onChange={e => { setTxnFilterEvent(e.target.value); setTxnPage(1); }} />
              </FG>
              <FG label="Payment Status">
                <select className="field-input w-44" value={txnFilterStatus}
                  onChange={e => { setTxnFilterStatus(e.target.value); setTxnPage(1); }}>
                  <option value="">All</option>
                  <option value="Success">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="FullyRefunded">Refunded</option>
                  <option value="PartiallyRefunded">Partially Refunded</option>
                  <option value="Failed">Failed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </FG>
              <FG label="Method">
                <select className="field-input w-40" value={txnFilterMethod}
                  onChange={e => { setTxnFilterMethod(e.target.value); setTxnPage(1); }}>
                  <option value="">All</option>
                  <option value="CreditCard">Credit Card</option>
                  <option value="PayNow">PayNow</option>
                  <option value="Cash">Cash</option>
                  <option value="BankTransfer">Bank Transfer</option>
                  <option value="Others">Others</option>
                </select>
              </FG>
            </div>
          </div>

          <div style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Receipt</th><th>Registration</th><th>Event</th>
                  <th>Programs</th><th>Method</th><th>Total</th>
                  <th>Refunded</th><th>Status</th><th>Paid Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pagedTxns.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-10 opacity-40">No transactions found.</td></tr>
                )}
                {pagedTxns.map(reg => {
                  const regRefunds = refunds.filter(r => r.paymentId === reg.payment.id);
                  const refunded   = calcRefunded(regRefunds, reg.payment.items);
                  const fee        = totalFee(reg);
                  return (
                    <tr key={reg.id}>
                      <td className="font-mono text-xs">{reg.payment.receiptNo || <span className="opacity-30">—</span>}</td>
                      <td>
                        <p className="font-mono text-xs">{reg.id}</p>
                        <p className="text-xs opacity-60">{reg.contactName}</p>
                      </td>
                      <td className="text-sm max-w-36"><p className="truncate">{reg.eventName}</p></td>
                      <td className="text-xs opacity-70">{reg.groups.map(g => g.programName).join(", ")}</td>
                      <td>
                        <span className="flex items-center gap-1.5 text-sm">
                          <MethodIcon method={reg.payment.method} />
                          {PAYMENT_METHOD_LABEL[reg.payment.method] ?? reg.payment.method}
                        </span>
                      </td>
                      <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>${fee.toFixed(2)}</td>
                      <td className="text-sm">
                        {refunded > 0
                          ? <span style={{ color: "var(--badge-open-text)" }}>${refunded.toFixed(2)}</span>
                          : <span className="opacity-30">—</span>}
                      </td>
                      <td><PayBadge status={reg.payment.paymentStatus} /></td>
                      <td className="text-xs opacity-70">{reg.payment.paidAt ? reg.payment.paidAt.slice(0, 10) : "—"}</td>
                      <td>
                        <button onClick={() => setReceiptModal(reg)}
                          className="p-2 hover:opacity-70" style={{ color: "var(--color-primary)" }} title="View Receipt">
                          <Receipt className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={txnPage} totalPages={txnTotalPgs} perPage={txnPerPage} total={txnTotal}
              setPage={setTxnPage} setPerPage={n => { setTxnPerPage(n); setTxnPage(1); }} />
          </div>
        </>
      )}

      {/* ══════════ MODALS ══════════ */}

      {/* Mark as Paid */}
      <Dialog open={!!markPaidModal} onOpenChange={v => { if (!v) { setMarkPaidModal(null); setMarkPaidRemark(""); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-7 pb-4" style={{ borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-lg">Mark as Paid</DialogTitle>
            {markPaidModal && (
              <p className="text-xs opacity-50 mt-1">
                {markPaidModal.id} · {markPaidModal.groups.map(g => g.programName).join(", ")} · Total: ${totalFee(markPaidModal).toFixed(2)}
              </p>
            )}
          </DialogHeader>
          <div className="p-7 space-y-4">
            <FG label="Payment Method *">
              <select className="field-input" value={markPaidMethod}
                onChange={e => setMarkPaidMethod(e.target.value as PaymentMethod)}>
                <option value="CreditCard">Credit Card</option>
                <option value="PayNow">PayNow</option>
                <option value="Cash">Cash</option>
                <option value="BankTransfer">Bank Transfer</option>
                <option value="Others">Others</option>
              </select>
            </FG>
            <FG label="Remark *">
              <textarea className="field-input" rows={2} value={markPaidRemark}
                onChange={e => setMarkPaidRemark(e.target.value)}
                placeholder="e.g. Cash collected at counter on 12 Mar" />
            </FG>
          </div>
          <DialogFooter className="p-7 pt-0">
            <button onClick={() => setMarkPaidModal(null)} className="btn-outline px-5 py-2.5 text-sm">Cancel</button>
            <button onClick={handleMarkPaid} disabled={!markPaidRemark.trim() || saving}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
              {saving ? "Saving…" : "Confirm Payment"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={!!cancelModal} onOpenChange={v => { if (!v) { setCancelModal(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-7 pb-4" style={{ borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-lg">Cancel Registration</DialogTitle>
          </DialogHeader>
          <div className="p-7 space-y-4">
            {cancelModal?.payment.paymentStatus === "Success" && (
              <div className="p-3 text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
                ⚠ This registration has been paid. A full refund will be triggered for all items.
              </div>
            )}
            <FG label="Reason *">
              <textarea className="field-input" rows={3} value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation…" />
            </FG>
          </div>
          <DialogFooter className="p-7 pt-0">
            <button onClick={() => setCancelModal(null)} className="btn-outline px-5 py-2.5 text-sm">Close</button>
            <button onClick={handleCancel} disabled={!cancelReason.trim() || saving}
              className="px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ backgroundColor: "var(--badge-closed-text)", color: "white" }}>
              {saving ? "Cancelling…" : "Confirm Cancel"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund */}
      <Dialog open={!!refundModal} onOpenChange={v => { if (!v) { setRefundModal(null); setRefundSel({}); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-7 pb-4" style={{ borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-lg">Process Refund</DialogTitle>
            {refundModal && <p className="text-xs opacity-50 mt-1">{refundModal.id} · {refundModal.contactName}</p>}
          </DialogHeader>
          <div className="p-7 space-y-4">
            {refundModal?.payment.items.map(item => {
              const alreadyRefunded = item.itemStatus === "Refunded";
              const existingRefund  = refunds.find(r => r.paymentItemId === item.id && r.refundStatus === "Success");
              const warning = refundModal && refundSel[item.id]?.checked
                ? getMinPlayersWarning(refundModal, item.id, events) : null;
              const isPerPlayer = !!item.participantId;
              return (
                <div key={item.id} className="p-4 space-y-3"
                  style={{ border: `1px solid ${warning ? "var(--badge-closed-text)" : "var(--color-table-border)"}`, opacity: alreadyRefunded ? 0.5 : 1 }}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Switch disabled={alreadyRefunded}
                      checked={refundSel[item.id]?.checked ?? false}
                      onCheckedChange={v => setRefundSel(p => ({ ...p, [item.id]: { checked: v, reason: p[item.id]?.reason ?? "" } }))} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">{item.programName}</span>
                          {isPerPlayer && item.playerName && <span className="text-xs opacity-60 ml-2">— {item.playerName}</span>}
                          {!isPerPlayer && <span className="text-xs opacity-40 ml-2">(per entry)</span>}
                        </div>
                        <span className="font-bold text-sm ml-3" style={{ color: "var(--color-primary)" }}>${item.amount.toFixed(2)}</span>
                      </div>
                      {alreadyRefunded && existingRefund && (
                        <p className="text-xs mt-0.5 opacity-60">
                          Refunded ${existingRefund.refundAmount.toFixed(2)} on {existingRefund.processedAt?.slice(0, 10) ?? "—"}
                        </p>
                      )}
                    </div>
                  </label>
                  {warning && (
                    <div className="flex items-start gap-2 p-3 text-xs font-medium"
                      style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)" }}>
                      ⚠ {warning}
                    </div>
                  )}
                  {refundSel[item.id]?.checked && !warning && (
                    <input className="field-input" placeholder="Reason *"
                      value={refundSel[item.id]?.reason ?? ""}
                      onChange={e => setRefundSel(p => ({ ...p, [item.id]: { ...p[item.id], reason: e.target.value } }))} />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="p-7 pt-0">
            <button onClick={() => setRefundModal(null)} className="btn-outline px-5 py-2.5 text-sm">Close</button>
            <button onClick={handleRefund}
              disabled={saving || !Object.entries(refundSel).some(([id, s]) =>
                s.checked && s.reason.trim() && refundModal && !getMinPlayersWarning(refundModal, id, events)
              )}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
              {saving ? "Processing…" : "Process Refund"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={!!receiptModal} onOpenChange={v => { if (!v) setReceiptModal(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-7 pb-4" style={{ borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-lg">
              {receiptModal?.payment.receiptNo ? `Receipt ${receiptModal.payment.receiptNo}` : "Payment Details"}
            </DialogTitle>
          </DialogHeader>
          {receiptModal && (() => {
            const regRefunds    = refunds.filter(r => r.paymentId === receiptModal.payment.id);
            const receiptRefunded = calcRefunded(regRefunds, receiptModal.payment.items);
            return (
              <div className="p-7 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs opacity-50 mb-0.5">Registration ID</p><p className="font-mono text-xs">{receiptModal.id}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Contact</p><p>{receiptModal.contactName}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Method</p><p>{PAYMENT_METHOD_LABEL[receiptModal.payment.method] ?? receiptModal.payment.method}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Paid Date</p><p>{receiptModal.payment.paidAt ? receiptModal.payment.paidAt.slice(0, 10) : "—"}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Status</p><PayBadge status={receiptModal.payment.paymentStatus} /></div>
                </div>
                <div style={{ borderTop: "1px solid var(--color-table-border)", paddingTop: 16 }}>
                  <p className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Programs / Line Items</p>
                  {receiptModal.payment.items.map(item => {
                    const group      = receiptModal.groups.find(g => g.id === item.participantGroupId);
                    const itemRefund = regRefunds.find(r => r.paymentItemId === item.id && r.refundStatus === "Success");
                    return (
                      <div key={item.id} className="mb-3 p-3"
                        style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{item.programName}</p>
                            {item.description && <p className="text-xs opacity-50">{item.description}</p>}
                            {group && !item.description && <p className="text-xs opacity-60">{group.namesDisplay}</p>}
                          </div>
                          <span className="font-bold text-sm flex-shrink-0" style={{ color: "var(--color-primary)" }}>
                            ${item.amount.toFixed(2)}
                          </span>
                        </div>
                        {itemRefund && (
                          <div className="mt-2 text-xs space-y-0.5" style={{ color: "var(--badge-open-text)" }}>
                            <p>Refunded ${itemRefund.refundAmount.toFixed(2)} on {itemRefund.processedAt?.slice(0, 10) ?? "—"}</p>
                            {itemRefund.refundReason && <p className="opacity-70">Reason: {itemRefund.refundReason}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-3 font-bold"
                    style={{ borderTop: "1px solid var(--color-table-border)" }}>
                    <span className="text-sm">Total</span>
                    <span style={{ color: "var(--color-primary)" }}>${totalFee(receiptModal).toFixed(2)}</span>
                  </div>
                  {receiptRefunded > 0 && (
                    <div className="flex items-center justify-between pt-1 text-sm" style={{ color: "var(--badge-open-text)" }}>
                      <span>Total Refunded</span>
                      <span>${receiptRefunded.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter className="p-7 pt-0">
            <button onClick={() => setReceiptModal(null)} className="btn-outline px-5 py-2.5 text-sm">Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}