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

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CreditCard, CheckCircle, XCircle, RefreshCw,
  Receipt, MoreVertical, Users, ExternalLink
} from "lucide-react";
import type { TournamentEvent } from "@/types/config";
import type { Registration, ParticipantGroup, Payment, PaymentItem, Refund, PaymentMethod, PaymentStatus } from "@/types/registration";
import { totalFee, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/types/registration";
import {
  apiGetEvents, apiGetRegistration, apiGetRegistrations,
  apiUpdateRegistrationStatus, apiUpdatePayment,
  apiGetRefunds, apiInitiateRefund, apiCancelRegistrationWithRefunds, apiConfirmRegistration, assetUrl,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/TableControls";
import { Switch } from "@/components/ui/switch";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ActionDropdownPortal from "@/components/ui/ActionDropdownPortal";

// ── Types ─────────────────────────────────────────────────────────────────────

type RegStatus = "Pending" | "Confirmed" | "Cancelled";

// Refunds use the shared Refund type from @/types/registration.

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

// PayBadge accepts the DB-aligned PaymentStatus codes and translates them
// to human labels using PAYMENT_STATUS_LABEL from registration.ts.
function PayBadge({ status }: { status: PaymentStatus }) {
  const label = PAYMENT_STATUS_LABEL[status] ?? status;
  const m: Record<string, [string, string]> = {
    S:  ["var(--badge-open-bg)",   "var(--badge-open-text)"],
    P:  ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    FR: ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
    PR: ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    F:  ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
    X:  ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
    W:  ["var(--badge-open-bg)",   "var(--badge-open-text)"],
    PC: ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
  };
  const [bg, text] = m[status] ?? m.P;
  return <span className="inline-flex px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: bg, color: text }}>{label}</span>;
}

function RegBadge({ status }: { status: string }) {
  const m: Record<string, [string, string]> = {
    "Confirmed":  ["var(--badge-open-bg)",   "var(--badge-open-text)"],
    "Pending":    ["var(--badge-soon-bg)",   "var(--badge-soon-text)"],
    "Cancelled":  ["var(--badge-closed-bg)", "var(--badge-closed-text)"],
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

function getPayment(reg: Registration | null | undefined): Payment | null {
  if (!reg) return null;
  return ((reg as Registration & { payment?: Payment | null }).payment) ?? null;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sum of Success refunds for a registration/payment item list. */
function calcRefunded(refunds: Refund[], items: PaymentItem[]): number {
  return items.reduce((sum, item) => {
    const r = refunds.find(r => r.paymentItemId === item.id && r.refundStatus === "S");
    return sum + (r?.refundAmount ?? 0);
  }, 0);
}


// ═══════════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminRegistrations() {
  const [urlParams] = useSearchParams();
  const navigate    = useNavigate();
  // Payment Log tab removed — now in 3-dot menu
  // ── Filters — declared before useEffects so effects can close over them ──
  const [filterEvent,   setFilterEvent]   = useState(urlParams.get("event") || "");
  const [filterProgram, setFilterProgram] = useState(urlParams.get("program") || "");
  const [filterReg,     setFilterReg]     = useState("");
  const [filterPay,     setFilterPay]     = useState("");
  const [filterSearchInput, setFilterSearchInput] = useState("");
  const [filterSearch,  setFilterSearch]  = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // ── Remote state ──────────────────────────────────────────────────────────
  const [events,      setEvents]      = useState<TournamentEvent[]>([]);
  const [regs,        setRegs]        = useState<Registration[]>([]);
  const [regTotal,    setRegTotal]    = useState(0);
  const [regTotalPgs, setRegTotalPgs] = useState(1);
  const [refundsByReg, setRefundsByReg] = useState<Record<string, Refund[]>>({});
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [apiError,    setApiError]    = useState("");

  useEffect(() => {
    apiGetEvents().then(r => { if (r.data) setEvents(r.data); });
  }, []);

  useEffect(() => {
    setLoadingRegs(true);
    apiGetRegistrations(
      {
        eventId:   filterEvent   || undefined,
        programId: filterProgram || undefined,
        regStatus: filterReg     || undefined,
        payStatus: filterPay     || undefined,
        search:    filterSearch  || undefined,
      },
      { page, pageSize: perPage },
    ).then(r => {
      if (r.data) {
        setRegs(r.data.items);
        setRegTotal(r.data.total);
        setRegTotalPgs(r.data.totalPages);
      }
    }).finally(() => setLoadingRegs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEvent, filterProgram, filterReg, filterPay, filterSearch, page, perPage]);

  useEffect(() => {
    let active = true;

    const uniqueRegs = Array.from(new Map(regs.map(reg => [reg.id, reg])).values());

    if (uniqueRegs.length === 0) {
      setRefundsByReg({});
      return () => { active = false; };
    }

    Promise.all(
      uniqueRegs.map(async (reg) => {
        const result = await apiGetRefunds(reg.id);
        return [reg.id, result.data ?? []] as const;
      }),
    ).then((entries) => {
      if (!active) return;
      setRefundsByReg(Object.fromEntries(entries));
    });

    return () => { active = false; };
  }, [regs]);

  const programsForEvent = useMemo(() =>
    events.find(e => e.id === filterEvent)?.programs ?? [], [events, filterEvent]);

  // Filtering is server-side; regs already contains the current page
  const sorted   = useMemo(() => [...regs].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [regs]);
  const paged    = sorted;

  // ── Action dropdown ───────────────────────────────────────────────────────
  const [openAction, setOpenAction] = useState<{ reg: Registration; anchorEl: HTMLElement } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilterSearch(filterSearchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filterSearchInput]);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [markPaidModal,  setMarkPaidModal]  = useState<Registration | null>(null);
  const [paymentLogModal, setPaymentLogModal] = useState<Registration | null>(null);
  const [cancelModal,    setCancelModal]    = useState<Registration | null>(null);
  const [refundModal,    setRefundModal]    = useState<Registration | null>(null);
  // PaymentMethod codes now match DB: "CreditCard" | "PayNow" | "Cash" | "BankTransfer" | "Others"
  const [markPaidMethod, setMarkPaidMethod] = useState<PaymentMethod>("PayNow");
  const [markPaidRemark, setMarkPaidRemark] = useState("");
  const [cancelReason,   setCancelReason]   = useState("");
  const [refundSel,      setRefundSel]      = useState<Record<string, { checked: boolean; reason: string }>>({});
  const [savingMarkPaid, setSavingMarkPaid] = useState(false);
  const [savingCancel,   setSavingCancel]   = useState(false);
  const [savingRefund,   setSavingRefund]   = useState(false);

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const handleMarkPaid = async () => {
    if (!markPaidModal || !markPaidRemark.trim()) return;
    setSavingMarkPaid(true);
    try {
      const payR = await apiUpdatePayment(markPaidModal.id, {
        paymentStatus: "S",
        method: markPaidMethod,
        adminNote: markPaidRemark,
      });
      if (payR.error) {
        setApiError(payR.error.message);
        return;
      }

      if (payR.data) {
        setRegs(prev => prev.map(reg => reg.id === payR.data!.id ? payR.data! : reg));
      }
      setMarkPaidModal(null);
      setMarkPaidRemark("");
      setMarkPaidMethod("PayNow");
    } finally {
      setSavingMarkPaid(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    const payment = getPayment(cancelModal);
    const hasRefundableItems = (payment?.items ?? []).some(item => item.itemStatus === "S");
    setSavingCancel(true);
    try {
      if (payment && hasRefundableItems) {
        const cancelR = await apiCancelRegistrationWithRefunds(cancelModal.id, cancelReason);
        if (cancelR.error) {
          setApiError(cancelR.error.message);
          return;
        }
        if (cancelR.data?.registration) {
          setRegs(prev => prev.map(reg => reg.id === cancelR.data!.registration.id ? cancelR.data!.registration : reg));
        }

        const refR = await apiGetRefunds(cancelModal.id);
        if (refR.data) {
          setRefundsByReg(prev => ({ ...prev, [cancelModal.id]: refR.data! }));
        }

        if ((cancelR.data?.errors ?? []).length > 0) {
          setApiError(`Cancellation is pending; some refunds failed: ${cancelR.data!.errors.join(" | ")}`);
          return;
        }

        setCancelModal(null);
        setCancelReason("");
        return;
      }

      const r = await apiUpdateRegistrationStatus(cancelModal.id, "Cancelled");
      if (r.error) {
        setApiError(r.error.message);
        return;
      }
      if (r.data) {
        setRegs(prev => prev.map(reg => reg.id === r.data!.id ? r.data! : reg));
      }

      setCancelModal(null);
      setCancelReason("");
    } finally {
      setSavingCancel(false);
    }
  };

  // ── Refund: check if removing a per-player item would drop group below minPlayers ──
  const getGroupMinPlayersWarning = (reg: Registration, itemId: string): string | null => {
    const payment = getPayment(reg);
    const item = payment?.items.find(i => i.id === itemId);
    if (!item?.participantId) return null;  // per_entry item — no player count check
    const group = reg.groups.find(g => g.id === item.participantGroupId);
    if (!group) return null;
    const eventProgram = events
      .flatMap(e => e.programs)
      .find(p => p.id === group.programId);
    if (!eventProgram) return null;
    // Count remaining per-player items for this group that are not already refunded
    const activeItems = (payment?.items ?? []).filter(
      i => i.participantGroupId === group.id
        && i.participantId
          && i.itemStatus !== "R"
        && i.id !== itemId
    );
    const remainingPlayers = activeItems.length;
    if (remainingPlayers < eventProgram.minPlayers) {
      return `Removing this player leaves ${remainingPlayers} player${remainingPlayers !== 1 ? "s" : ""} — below the minimum of ${eventProgram.minPlayers}. Cancel the entire entry instead.`;
    }
    return null;
  };

  const handleRefund = async () => {
    if (!refundModal) return;
    const payment = getPayment(refundModal);
    if (!payment) {
      setApiError("This registration has no payment record to refund.");
      return;
    }
    setSavingRefund(true);
    try {
      const refundErrors: string[] = [];
      for (const [itemId, sel] of Object.entries(refundSel)) {
        if (!sel.checked || !sel.reason.trim()) continue;
        if (getGroupMinPlayersWarning(refundModal, itemId)) continue;
        const item = payment.items.find(i => i.id === itemId);
        if (!item) continue;
        const refundResult = await apiInitiateRefund(refundModal.id, itemId, item.amount, sel.reason, "admin");
        if (refundResult.error) refundErrors.push(`${item.programName}: ${refundResult.error.message}`);
      }
      const [regR, refR] = await Promise.all([
        apiGetRegistration(refundModal.id),
        apiGetRefunds(refundModal.id),
      ]);
      if (regR.data) {
        setRegs(prev => prev.map(r => r.id === refundModal.id ? regR.data! : r));
        }
      if (refR.data) {
        setRefundsByReg(prev => ({ ...prev, [refundModal.id]: refR.data! }));
      }
      if (refundErrors.length > 0) {
        setApiError(`Some refunds failed: ${refundErrors.join(" | ")}`);
        return;
      }
      setRefundModal(null);
      setRefundSel({});
    } finally {
      setSavingRefund(false);
    }
  };


  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="sticky-header">
        <div className="admin-page-title"><h1>Registrations &amp; Payments</h1></div>
        {apiError && (
          <div className="mb-4 px-4 py-3 text-sm font-medium flex items-center justify-between"
            style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)", border: "1px solid var(--badge-closed-text)" }}>
            <span>{apiError}</span>
            <button onClick={() => setApiError("")} className="ml-4 opacity-60 hover:opacity-100 text-xs font-bold">✕</button>
          </div>
        )}

      </div>

      {/* ══════════ REGISTRATIONS ══════════ */}
      <>
          {/* Filters */}
          <div className="p-4 mb-5" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="flex flex-wrap items-end gap-3">
              <FG label="Search">
                <input className="field-input w-52" placeholder="Name, ID, club…"
                  value={filterSearchInput} onChange={e => setFilterSearchInput(e.target.value)} />
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
                {/* Values are DB-aligned PaymentStatus codes */}
                <select className="field-input w-40" value={filterPay}
                  onChange={e => { setFilterPay(e.target.value); setPage(1); }}>
                  <option value="">All</option>
              <option value="S">Paid</option>
              <option value="P">Pending</option>
              <option value="FR">Refunded</option>
              <option value="PR">Partially Refunded</option>
              <option value="F">Failed</option>
              <option value="X">Cancelled</option>
                </select>
              </FG>
            </div>
          </div>

          {/* Table */}
          <div style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
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
                {loadingRegs && (
                  <tr><td colSpan={10} className="text-center py-6"><LoadingSpinner size="sm" label="Loading registrations…" /></td></tr>
                )}
                {!loadingRegs && paged.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-10 opacity-40">No registrations found.</td></tr>
                )}
                {paged.map(reg => {
                  const payment = getPayment(reg);
                  const programCount = reg.groups.length;
                  const regRefunds  = refundsByReg[reg.id] ?? [];
                  const refunded    = calcRefunded(regRefunds, payment?.items ?? []);

                  return (
                    <React.Fragment key={reg.id}>
            <tr style={reg.regStatus === "Pending" || payment?.paymentStatus === "P"
                        ? { borderLeft: "3px solid var(--badge-soon-text)" } : undefined}>
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
                        <td>{payment ? <PayBadge status={payment.paymentStatus} /> : <span className="opacity-40">No payment</span>}</td>
                        <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>
                          ${payment ? totalFee(reg).toFixed(2) : "0.00"}
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
                          <div className="relative">
                            <button
                              onClick={(e) =>
                                setOpenAction(openAction?.reg.id === reg.id ? null : { reg, anchorEl: e.currentTarget })
                              }
                              className="p-2 hover:opacity-70" style={{ color: "var(--color-primary)" }}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} totalPages={regTotalPgs} perPage={perPage} total={regTotal}
              setPage={setPage} setPerPage={n => { setPerPage(n); setPage(1); }} />
          </div>
        </>

      {/* Payment Log tab removed — accessible via 3-dot menu */}

      {/* ══════════ MODALS ══════════ */}

      <ActionDropdownPortal
        open={!!openAction}
        anchorEl={openAction?.anchorEl ?? null}
        onClose={() => setOpenAction(null)}
      >
        {openAction && (
          <>
            <button
              disabled={!(getPayment(openAction.reg)?.paymentStatus === "P" && openAction.reg.regStatus !== "Cancelled")}
              onClick={() => { setMarkPaidModal(openAction.reg); setOpenAction(null); }}
            >
              <CheckCircle className="h-4 w-4" /> Mark as Paid
            </button>
            <button
              disabled={!((getPayment(openAction.reg)?.items ?? []).some(item => item.itemStatus === "S") && openAction.reg.regStatus !== "Cancelled")}
              onClick={() => { setRefundSel({}); setRefundModal(openAction.reg); setOpenAction(null); }}
            >
              <RefreshCw className="h-4 w-4" /> Refund
            </button>
            <button onClick={() => { setPaymentLogModal(openAction.reg); setOpenAction(null); }}>
              <Receipt className="h-4 w-4" /> Payment Log
            </button>
            <button onClick={() => {
              navigate(`/admin/registrations/${openAction.reg.id}/participants`);
              setOpenAction(null);
            }}>
              <Users className="h-4 w-4" /> Participant List
            </button>
            <button
              disabled={!(openAction.reg.regStatus !== "Cancelled")}
              onClick={() => { setCancelModal(openAction.reg); setOpenAction(null); }}
              style={{ color: openAction.reg.regStatus !== "Cancelled" ? "var(--badge-closed-text)" : undefined }}
            >
              <XCircle className="h-4 w-4" /> Cancel
            </button>
          </>
        )}
      </ActionDropdownPortal>

      {/* Mark as Paid */}
      <Dialog open={!!markPaidModal} onOpenChange={v => { if (!v) { setMarkPaidModal(null); setMarkPaidRemark(""); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-7 pb-4" style={{ borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-lg">Mark as Paid</DialogTitle>
            {markPaidModal && (
              <p className="text-xs opacity-50 mt-1">
                {markPaidModal.id} · {markPaidModal.groups.map(g => g.programName).join(", ")} · Total: ${getPayment(markPaidModal) ? totalFee(markPaidModal).toFixed(2) : "0.00"}
              </p>
            )}
          </DialogHeader>
          <div className="p-7 space-y-4">
            <FG label="Payment Method *">
              {/* <select> shows human labels; value is DB-aligned code */}
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
            <button onClick={handleMarkPaid} disabled={!markPaidRemark.trim() || savingMarkPaid}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
              {savingMarkPaid ? "Saving..." : "Confirm Payment"}
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
            {/* Check "Success" (paid) not old "Paid" string */}
            {getPayment(cancelModal as Registration)?.paymentStatus === "S" && (
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
            <button onClick={handleCancel} disabled={!cancelReason.trim() || savingCancel}
              className="px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ backgroundColor: "var(--badge-closed-text)", color: "white" }}>
              {savingCancel ? "Cancelling..." : "Confirm Cancel"}
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
            {/* Iterate payment items (was lineItems) */}
            {(getPayment(refundModal as Registration)?.items ?? []).map(item => {
              // Already refunded = item has been confirmed refunded
              const alreadyRefunded = item.itemStatus === "R";
              const existingRefund  = (refundModal ? (refundsByReg[refundModal.id] ?? []) : [])
                .find(r => r.paymentItemId === item.id && r.refundStatus === "S");
              const warning = refundModal && refundSel[item.id]?.checked
                ? getGroupMinPlayersWarning(refundModal, item.id)
                : null;
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
                          {isPerPlayer && item.playerName && (
                            <span className="text-xs opacity-60 ml-2">— {item.playerName}</span>
                          )}
                          {!isPerPlayer && (
                            <span className="text-xs opacity-40 ml-2">(per entry)</span>
                          )}
                        </div>
                        <span className="font-bold text-sm ml-3" style={{ color: "var(--color-primary)" }}>
                          ${item.amount.toFixed(2)}
                        </span>
                      </div>
                      {alreadyRefunded && existingRefund && (
                        <p className="text-xs mt-0.5 opacity-60">
                          Already refunded ${existingRefund.refundAmount.toFixed(2)} on {formatDateTime(existingRefund.createdAt)}
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
              disabled={!Object.entries(refundSel).some(([id, s]) => {
                if (!s.checked || !s.reason.trim()) return false;
                if (refundModal && getGroupMinPlayersWarning(refundModal, id)) return false;
                return true;
              }) || savingRefund}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
              {savingRefund ? "Processing..." : "Process Refund"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={!!paymentLogModal} onOpenChange={v => { if (!v) setPaymentLogModal(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-7 pb-4" style={{ borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-lg">
              {getPayment(paymentLogModal)?.receiptNo ? `Receipt ${getPayment(paymentLogModal)?.receiptNo}` : "Payment Log"}
            </DialogTitle>
          </DialogHeader>
          {paymentLogModal && (() => {
            const receiptPayment = getPayment(paymentLogModal);
            const receiptRefunds = refundsByReg[paymentLogModal!.id] ?? [];
            const receiptRefunded = calcRefunded(receiptRefunds, receiptPayment?.items ?? []);
            return (
              <div className="p-7 space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs opacity-50 mb-0.5">Registration ID</p><p className="font-mono text-xs">{paymentLogModal!.id}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Contact</p><p>{paymentLogModal!.contactName}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Gateway Session ID</p><p className="font-mono text-xs opacity-70">{receiptPayment?.gatewaySessionId || "—"}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Gateway Payment ID</p><p className="font-mono text-xs opacity-70">{receiptPayment?.gatewayPaymentId || "—"}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Charge ID</p><p className="font-mono text-xs opacity-70">{receiptPayment?.gatewayChargeId || "—"}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Receipt No.</p><p className="font-mono text-xs font-bold">{receiptPayment?.receiptNo || "—"}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Method</p><p>{receiptPayment ? (PAYMENT_METHOD_LABEL[receiptPayment.method] ?? receiptPayment.method) : "—"}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Paid Date</p><p>{formatDate(receiptPayment?.paidAt)}</p></div>
                  <div><p className="text-xs opacity-50 mb-0.5">Status</p>{receiptPayment ? <PayBadge status={receiptPayment.paymentStatus} /> : <p className="opacity-50">No payment</p>}</div>
                </div>

                {/* Line items (payment.items) */}
                <div style={{ borderTop: "1px solid var(--color-table-border)", paddingTop: 16 }}>
                  <p className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Programs / Line Items</p>
                    {(receiptPayment?.items ?? []).map(item => {
                      const group        = paymentLogModal!.groups.find(g => g.id === item.participantGroupId);
                const itemRefund   = receiptRefunds.find(r => r.paymentItemId === item.id && r.refundStatus === "S");
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
                        {/* Show refund info from the separate Refunds store */}
                        {itemRefund && (
                          <div className="mt-2 text-xs space-y-0.5" style={{ color: "var(--badge-open-text)" }}>
                            <p>Refunded ${itemRefund.refundAmount.toFixed(2)} on {formatDateTime(itemRefund.createdAt)}</p>
                            <p className="opacity-70">Reason: {itemRefund.refundReason}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between pt-3 font-bold"
                    style={{ borderTop: "1px solid var(--color-table-border)" }}>
                    <span className="text-sm">Total</span>
                    <span style={{ color: "var(--color-primary)" }}>${receiptPayment ? totalFee(paymentLogModal!).toFixed(2) : "0.00"}</span>
                  </div>
                  {receiptRefunded > 0 && (
                    <div className="flex items-center justify-between pt-1 text-sm"
                      style={{ color: "var(--badge-open-text)" }}>
                      <span>Total Refunded</span>
                      <span>${receiptRefunded.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {receiptPayment?.adminNote && (
                  <div className="p-3 text-xs" style={{ backgroundColor: "var(--color-row-hover)", border: "1px solid var(--color-table-border)" }}>
                    <span className="opacity-50 font-semibold uppercase tracking-wide mr-2">Admin Note</span>
                    {receiptPayment.adminNote}
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="p-7 pt-0">
            <button onClick={() => setPaymentLogModal(null)} className="btn-outline px-5 py-2.5 text-sm">Close</button>
            {paymentLogModal && getPayment(paymentLogModal)?.receiptNo && (
              <a
                href={`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/registrations/${paymentLogModal.id}/receipt`}
                target="_blank" rel="noopener noreferrer"
                className="btn-primary px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Download Receipt PDF
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
