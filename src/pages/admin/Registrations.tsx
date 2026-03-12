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
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CreditCard, CheckCircle, XCircle, RefreshCw, ChevronUp, ChevronDown,
  ChevronsUpDown, Receipt, MoreVertical, ChevronRight, Users
} from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent, PaymentMethod } from "@/types/config";
import type { Registration, ParticipantGroup, Payment } from "@/types/registration";
import { totalFee, totalRefunded } from "@/types/registration";
import { MOCK_REGISTRATIONS } from "@/data/mock-registrations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/TableControls";
import { Switch } from "@/components/ui/switch";

// ── Types ─────────────────────────────────────────────────────────────────────

type RegStatus = "Pending" | "Confirmed" | "Cancelled" | "Waitlisted";
type PayStatus = "Pending" | "Paid" | "Refunded" | "Partially Refunded";

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

function PayBadge({ status }: { status: string }) {
  const m: Record<string, [string, string]> = {
    "Paid":               ["var(--badge-open-bg)",   "var(--badge-open-text)"],
    "Pending":            ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    "Refunded":           ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
    "Partially Refunded": ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
  };
  const [bg, text] = m[status] ?? m["Pending"];
  return <span className="inline-flex px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: bg, color: text }}>{status}</span>;
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

function MethodIcon({ method }: { method: string }) {
  if (method === "Credit Card") return <CreditCard className="h-3.5 w-3.5 opacity-60" />;
  if (method === "PayNow") return <span className="text-xs font-bold px-1" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>PN</span>;
  return null;
}

function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold mb-1.5 opacity-60">{label}</label>{children}</div>;
}

// ── Expanded row — shows groups + participants ─────────────────────────────────

function ExpandedRow({ reg }: { reg: Registration }) {
  return (
    <tr>
      <td colSpan={8} style={{ padding: 0, backgroundColor: "var(--color-row-hover)" }}>
        <div className="px-6 py-4 space-y-4">
          {reg.groups.map(group => (
            <div key={group.id} style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-page-bg)" }}>
              {/* Group header */}
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
              {/* Participants */}
              <table className="trs-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>DOB</th>
                    <th>Gender</th>
                    <th>Club / School</th>
                    <th>SBA ID</th>
                    <th>Contact</th>
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

          {/* Payment summary */}
          <div className="flex items-center gap-4 text-xs opacity-60 pt-1">
            <span>Receipt: <strong className="font-mono">{reg.payment.receiptNo || "—"}</strong></span>
            <span>·</span>
            <span>Method: {reg.payment.method}</span>
            <span>·</span>
            <span>Paid: {reg.payment.paidDate || "—"}</span>
            <span>·</span>
            <span>Total: <strong style={{ color: "var(--color-primary)" }}>${totalFee(reg).toFixed(2)}</strong></span>
            {totalRefunded(reg) > 0 && (
              <><span>·</span><span style={{ color: "var(--badge-open-text)" }}>Refunded: ${totalRefunded(reg).toFixed(2)}</span></>
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
  const events = config.events as TournamentEvent[];

  // ── State ─────────────────────────────────────────────────────────────────
  const [regs, setRegs] = useState<Registration[]>(MOCK_REGISTRATIONS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterEvent,   setFilterEvent]   = useState(urlParams.get("event") || "");
  const [filterProgram, setFilterProgram] = useState(urlParams.get("program") || "");
  const [filterReg,     setFilterReg]     = useState("");
  const [filterPay,     setFilterPay]     = useState("");
  const [filterSearch,  setFilterSearch]  = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const programsForEvent = useMemo(() =>
    events.find(e => e.id === filterEvent)?.programs ?? [], [events, filterEvent]);

  const filtered = useMemo(() => regs.filter(r => {
    if (filterEvent && r.eventId !== filterEvent) return false;
    if (filterProgram && !r.groups.some(g => g.programId === filterProgram)) return false;
    if (filterReg && r.regStatus !== filterReg) return false;
    if (filterPay && r.payment.paymentStatus !== filterPay) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const hit = r.contactName.toLowerCase().includes(q)
        || r.id.toLowerCase().includes(q)
        || r.groups.some(g => g.namesDisplay.toLowerCase().includes(q) || g.clubDisplay.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  }), [regs, filterEvent, filterProgram, filterReg, filterPay, filterSearch]);

  // Sort by submittedAt desc by default
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

  // ── Modals ────────────────────────────────────────────────────────────────
  const [markPaidModal,  setMarkPaidModal]  = useState<Registration | null>(null);
  const [cancelModal,    setCancelModal]    = useState<Registration | null>(null);
  const [refundModal,    setRefundModal]    = useState<Registration | null>(null);
  const [receiptModal,   setReceiptModal]   = useState<Registration | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<PaymentMethod>("PayNow");
  const [markPaidRemark, setMarkPaidRemark] = useState("");
  const [cancelReason,   setCancelReason]   = useState("");
  const [refundSel,      setRefundSel]      = useState<Record<string, { checked: boolean; reason: string }>>({});

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const updateReg = (id: string, fn: (r: Registration) => Registration) =>
    setRegs(prev => prev.map(r => r.id === id ? fn(r) : r));

  const handleMarkPaid = () => {
    if (!markPaidModal || !markPaidRemark.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const rcpt  = `RCP-${String(Date.now()).slice(-4)}`;
    updateReg(markPaidModal.id, r => ({
      ...r,
      regStatus: "Confirmed" as RegStatus,
      groups: r.groups.map(g => ({ ...g, groupStatus: "Confirmed" as RegStatus })),
      payment: {
        ...r.payment,
        paymentStatus: "Paid",
        paidDate: today,
        receiptNo: rcpt,
        method: markPaidMethod,
        remarks: markPaidRemark,
      }
    }));
    setMarkPaidModal(null); setMarkPaidRemark(""); setMarkPaidMethod("PayNow");
  };

  const handleCancel = () => {
    if (!cancelModal || !cancelReason.trim()) return;
    const today  = new Date().toISOString().slice(0, 10);
    const wasPaid = cancelModal.payment.paymentStatus === "Paid";
    updateReg(cancelModal.id, r => ({
      ...r,
      regStatus: "Cancelled",
      groups: r.groups.map(g => ({ ...g, groupStatus: "Cancelled" as RegStatus })),
      payment: wasPaid
        ? {
            ...r.payment,
            paymentStatus: "Refunded",
            lineItems: r.payment.lineItems.map(li => ({
              ...li,
              refundedAmount: li.amount,
              refundStatus: "Full" as const,
              refundDate: today,
              refundReason: `Cancelled: ${cancelReason}`,
            })),
          }
        : r.payment,
    }));
    setCancelModal(null); setCancelReason("");
  };

  const handleRefund = () => {
    if (!refundModal) return;
    const today = new Date().toISOString().slice(0, 10);
    updateReg(refundModal.id, r => {
      const lineItems = r.payment.lineItems.map(li => {
        const sel = refundSel[li.id];
        if (!sel?.checked || !sel.reason.trim()) return li;
        return { ...li, refundedAmount: li.amount, refundStatus: "Full" as const, refundDate: today, refundReason: sel.reason };
      });
      const allRefunded  = lineItems.every(li => li.refundStatus === "Full");
      const someRefunded = lineItems.some(li => li.refundStatus === "Full");
      return {
        ...r,
        payment: {
          ...r.payment,
          lineItems,
          paymentStatus: (allRefunded ? "Refunded" : someRefunded ? "Partially Refunded" : r.payment.paymentStatus) as any,
        }
      };
    });
    setRefundModal(null); setRefundSel({});
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── Payment tab data ──────────────────────────────────────────────────────
  const [txnFilterEvent,  setTxnFilterEvent]  = useState("");
  const [txnFilterStatus, setTxnFilterStatus] = useState("");
  const [txnFilterMethod, setTxnFilterMethod] = useState("");
  const [txnPage, setTxnPage] = useState(1);
  const [txnPerPage, setTxnPerPage] = useState(10);

  const filteredTxns = useMemo(() => regs.filter(r => {
    if (txnFilterEvent && !r.eventName.toLowerCase().includes(txnFilterEvent.toLowerCase())) return false;
    if (txnFilterStatus && r.payment.paymentStatus !== txnFilterStatus) return false;
    if (txnFilterMethod && r.payment.method !== txnFilterMethod) return false;
    return true;
  }), [regs, txnFilterEvent, txnFilterStatus, txnFilterMethod]);

  const txnTotal = filteredTxns.length;
  const txnTotalPgs = Math.max(1, Math.ceil(txnTotal / txnPerPage));
  const pagedTxns = filteredTxns.slice((txnPage - 1) * txnPerPage, txnPage * txnPerPage);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
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
                </select>
              </FG>
              <FG label="Payment">
                <select className="field-input w-36" value={filterPay}
                  onChange={e => { setFilterPay(e.target.value); setPage(1); }}>
                  <option value="">All</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Refunded">Refunded</option>
                  <option value="Partially Refunded">Partially Refunded</option>
                </select>
              </FG>
            </div>
          </div>

          {/* Table */}
          <div style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Reg ID</th>
                  <th>Contact</th>
                  <th>Event</th>
                  <th>Programs</th>
                  <th>Reg. Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-10 opacity-40">No registrations found.</td></tr>
                )}
                {paged.map(reg => {
                  const isExpanded = expanded.has(reg.id);
                  const canPay     = reg.payment.paymentStatus === "Pending" && reg.regStatus !== "Cancelled";
                  const canRefund  = reg.payment.paymentStatus === "Paid" && reg.regStatus !== "Cancelled";
                  const canCancel  = reg.regStatus !== "Cancelled";
                  const programCount = reg.groups.length;

                  return (
                    <React.Fragment key={reg.id}>
                      <tr style={reg.regStatus === "Pending" || reg.payment.paymentStatus === "Pending"
                        ? { borderLeft: "3px solid var(--badge-soon-text)" } : undefined}>
                        {/* Expand toggle */}
                        <td>
                          <button onClick={() => toggleExpand(reg.id)}
                            className="p-1 opacity-40 hover:opacity-80">
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="font-mono text-xs">{reg.id}</td>
                        <td>
                          <p className="font-semibold text-sm">{reg.contactName}</p>
                          <p className="text-xs opacity-50">{reg.contactEmail}</p>
                        </td>
                        <td className="text-sm max-w-40">
                          <p className="truncate">{reg.eventName}</p>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 opacity-30" />
                            <span className="text-sm">{programCount} program{programCount !== 1 ? "s" : ""}</span>
                          </div>
                          <p className="text-xs opacity-50 mt-0.5">
                            {reg.groups.map(g => g.programName).join(", ")}
                          </p>
                        </td>
                        <td><RegBadge status={reg.regStatus} /></td>
                        <td><PayBadge status={reg.payment.paymentStatus} /></td>
                        <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>
                          ${totalFee(reg).toFixed(2)}
                          {totalRefunded(reg) > 0 && (
                            <span className="block text-xs font-normal" style={{ color: "var(--badge-open-text)" }}>
                              −${totalRefunded(reg).toFixed(2)} refunded
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
                                  onClick={() => {
                                    setRefundSel({});
                                    setRefundModal(reg);
                                    setOpenAction(null);
                                  }}>
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
                      {isExpanded && <ExpandedRow reg={reg} />}
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
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Refunded">Refunded</option>
                  <option value="Partially Refunded">Partially Refunded</option>
                </select>
              </FG>
              <FG label="Method">
                <select className="field-input w-40" value={txnFilterMethod}
                  onChange={e => { setTxnFilterMethod(e.target.value); setTxnPage(1); }}>
                  <option value="">All</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="PayNow">PayNow</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Others">Others</option>
                </select>
              </FG>
            </div>
          </div>

          <div style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Registration</th>
                  <th>Event</th>
                  <th>Programs</th>
                  <th>Method</th>
                  <th>Total</th>
                  <th>Refunded</th>
                  <th>Status</th>
                  <th>Paid Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedTxns.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-10 opacity-40">No transactions found.</td></tr>
                )}
                {pagedTxns.map(reg => {
                  const refunded = totalRefunded(reg);
                  const fee      = totalFee(reg);
                  return (
                    <tr key={reg.id}>
                      <td className="font-mono text-xs">
                        {reg.payment.receiptNo || <span className="opacity-30">—</span>}
                      </td>
                      <td>
                        <p className="font-mono text-xs">{reg.id}</p>
                        <p className="text-xs opacity-60">{reg.contactName}</p>
                      </td>
                      <td className="text-sm max-w-36"><p className="truncate">{reg.eventName}</p></td>
                      <td className="text-xs opacity-70">
                        {reg.groups.map(g => g.programName).join(", ")}
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5 text-sm">
                          <MethodIcon method={reg.payment.method} />
                          {reg.payment.method}
                        </span>
                      </td>
                      <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>
                        ${fee.toFixed(2)}
                      </td>
                      <td className="text-sm">
                        {refunded > 0
                          ? <span style={{ color: "var(--badge-open-text)" }}>${refunded.toFixed(2)}</span>
                          : <span className="opacity-30">—</span>}
                      </td>
                      <td><PayBadge status={reg.payment.paymentStatus} /></td>
                      <td className="text-xs opacity-70">{reg.payment.paidDate || "—"}</td>
                      <td>
                        <button onClick={() => setReceiptModal(reg)}
                          className="p-2 hover:opacity-70" style={{ color: "var(--color-primary)" }}
                          title="View Receipt">
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
                <option value="Credit Card">Credit Card</option>
                <option value="PayNow">PayNow</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
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
            <button onClick={handleMarkPaid} disabled={!markPaidRemark.trim()}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
              Confirm Payment
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
            {cancelModal?.payment.paymentStatus === "Paid" && (
              <div className="p-3 text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
                ⚠ This registration has been paid. A full refund will be triggered for all line items.
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
            <button onClick={handleCancel} disabled={!cancelReason.trim()}
              className="px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ backgroundColor: "var(--badge-closed-text)", color: "white" }}>
              Confirm Cancel
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
            {refundModal?.payment.lineItems.map(li => {
              const alreadyRefunded = li.refundStatus === "Full";
              return (
                <div key={li.id} className="p-4 space-y-3"
                  style={{ border: "1px solid var(--color-table-border)", opacity: alreadyRefunded ? 0.5 : 1 }}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Switch disabled={alreadyRefunded}
                      checked={refundSel[li.id]?.checked ?? false}
                      onCheckedChange={v => setRefundSel(p => ({ ...p, [li.id]: { checked: v, reason: p[li.id]?.reason ?? "" } }))} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{li.programName}</span>
                        <span className="font-bold text-sm ml-3" style={{ color: "var(--color-primary)" }}>
                          ${li.amount.toFixed(2)}
                        </span>
                      </div>
                      {alreadyRefunded && <p className="text-xs mt-0.5 opacity-60">Already refunded on {li.refundDate}</p>}
                    </div>
                  </label>
                  {refundSel[li.id]?.checked && (
                    <input className="field-input" placeholder="Reason *"
                      value={refundSel[li.id]?.reason ?? ""}
                      onChange={e => setRefundSel(p => ({ ...p, [li.id]: { ...p[li.id], reason: e.target.value } }))} />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="p-7 pt-0">
            <button onClick={() => setRefundModal(null)} className="btn-outline px-5 py-2.5 text-sm">Close</button>
            <button onClick={handleRefund}
              disabled={!Object.values(refundSel).some(s => s.checked && s.reason.trim())}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
              Process Refund
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
          {receiptModal && (
            <div className="p-7 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs opacity-50 mb-0.5">Registration ID</p><p className="font-mono text-xs">{receiptModal.id}</p></div>
                <div><p className="text-xs opacity-50 mb-0.5">Contact</p><p>{receiptModal.contactName}</p></div>
                <div><p className="text-xs opacity-50 mb-0.5">Method</p><p>{receiptModal.payment.method}</p></div>
                <div><p className="text-xs opacity-50 mb-0.5">Paid Date</p><p>{receiptModal.payment.paidDate || "—"}</p></div>
                <div><p className="text-xs opacity-50 mb-0.5">Status</p><PayBadge status={receiptModal.payment.paymentStatus} /></div>
              </div>

              {/* Line items */}
              <div style={{ borderTop: "1px solid var(--color-table-border)", paddingTop: 16 }}>
                <p className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Programs / Line Items</p>
                {receiptModal.payment.lineItems.map(li => {
                  const group = receiptModal.groups.find(g => g.id === li.participantGroupId);
                  return (
                    <div key={li.id} className="mb-3 p-3"
                      style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{li.programName}</p>
                          {group && <p className="text-xs opacity-60">{group.namesDisplay}</p>}
                        </div>
                        <span className="font-bold text-sm flex-shrink-0" style={{ color: "var(--color-primary)" }}>
                          ${li.amount.toFixed(2)}
                        </span>
                      </div>
                      {li.refundStatus !== "None" && (
                        <div className="mt-2 text-xs space-y-0.5" style={{ color: "var(--badge-open-text)" }}>
                          <p>Refunded ${li.refundedAmount.toFixed(2)} on {li.refundDate}</p>
                          <p className="opacity-70">Reason: {li.refundReason}</p>
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
                {totalRefunded(receiptModal) > 0 && (
                  <div className="flex items-center justify-between pt-1 text-sm"
                    style={{ color: "var(--badge-open-text)" }}>
                    <span>Total Refunded</span>
                    <span>${totalRefunded(receiptModal).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {receiptModal.payment.remarks && (
                <div className="text-xs opacity-60 italic">{receiptModal.payment.remarks}</div>
              )}
            </div>
          )}
          <DialogFooter className="p-7 pt-0">
            <button onClick={() => setReceiptModal(null)} className="btn-outline px-5 py-2.5 text-sm">Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}