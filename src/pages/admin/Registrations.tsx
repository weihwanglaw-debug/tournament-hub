import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, CheckCircle, XCircle, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, Receipt, MoreVertical } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent, PaymentRecord, PaymentLineItem, PaymentMethod } from "@/types/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/TableControls";
import { Switch } from "@/components/ui/switch";

// ── Sample data ──
const INIT_REGS = [
  { id: "R001", club: "Pasir Ris BC", name: "Lee Wei Jie", event: "evt-1", eventName: "Singapore Open 2026", program: "prog-1", programName: "Men's Singles", paymentStatus: "Pending", regStatus: "Pending", amount: 80 },
  { id: "R002", club: "Tampines BC", name: "Tan Mei Ling", event: "evt-1", eventName: "Singapore Open 2026", program: "prog-2", programName: "Women's Singles", paymentStatus: "Pending", regStatus: "Pending", amount: 80 },
  { id: "R003", club: "Jurong BC", name: "Ravi Kumar / Wong Xiu", event: "evt-1", eventName: "Singapore Open 2026", program: "prog-3", programName: "Mixed Doubles", paymentStatus: "Paid", regStatus: "Confirmed", amount: 120 },
  { id: "R004", club: "Bishan SC", name: "Michael Ng", event: "evt-2", eventName: "Junior Tournament", program: "prog-5", programName: "Boys U15 Singles", paymentStatus: "Paid", regStatus: "Confirmed", amount: 40 },
  { id: "R005", club: "Serangoon BC", name: "Rachel Tan", event: "evt-2", eventName: "Junior Tournament", program: "prog-6", programName: "Girls U15 Singles", paymentStatus: "Refunded", regStatus: "Cancelled", amount: 40 },
  { id: "R006", club: "Yishun United", name: "Wei Hao", event: "evt-3", eventName: "Inter-Club League", program: "prog-8", programName: "Team Event", paymentStatus: "Pending", regStatus: "Pending", amount: 200 },
];

const INIT_PAYMENTS: PaymentRecord[] = [
  { id: "TXN-001", registrationId: "R003", event: "Singapore Open 2026", program: "Mixed Doubles", participants: "Ravi Kumar / Wong Xiu", method: "Credit Card", paidDate: "2026-02-12", receiptNumber: "RCP-0001", paymentStatus: "Paid", lineItems: [{ id: "li1", label: "Registration Fee — Mixed Doubles", amount: 120, refundedAmount: 0, refundStatus: "None" }] },
  { id: "TXN-002", registrationId: "R004", event: "Junior Tournament", program: "Boys U15 Singles", participants: "Michael Ng", method: "PayNow", paidDate: "2026-02-15", receiptNumber: "RCP-0002", paymentStatus: "Paid", lineItems: [{ id: "li2", label: "Registration Fee — Boys U15 Singles", amount: 40, refundedAmount: 0, refundStatus: "None" }] },
  { id: "TXN-003", registrationId: "R005", event: "Junior Tournament", program: "Girls U15 Singles", participants: "Rachel Tan", method: "Credit Card", paidDate: "2026-02-10", receiptNumber: "RCP-0003", paymentStatus: "Refunded", lineItems: [{ id: "li3", label: "Registration Fee — Girls U15 Singles", amount: 40, refundedAmount: 40, refundStatus: "Full", refundDate: "2026-02-18", refundReason: "Participant withdrew due to injury" }] },
  { id: "TXN-004", registrationId: "R001", event: "Singapore Open 2026", program: "Men's Singles", participants: "Lee Wei Jie", method: "Others", paidDate: "", receiptNumber: "", paymentStatus: "Pending", lineItems: [{ id: "li4", label: "Registration Fee — Men's Singles", amount: 80, refundedAmount: 0, refundStatus: "None" }] },
  { id: "TXN-005", registrationId: "R006", event: "Inter-Club League", program: "Team Event", participants: "Wei Hao", method: "Others", paidDate: "", receiptNumber: "", paymentStatus: "Pending", lineItems: [{ id: "li5", label: "Registration Fee — Team Event", amount: 200, refundedAmount: 0, refundStatus: "None" }] },
];

type Reg = typeof INIT_REGS[0];
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

export default function AdminRegistrations() {
  const [urlParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"registrations" | "payments">("registrations");
  const events = config.events as TournamentEvent[];

  const [regData, setRegData] = useState(INIT_REGS);
  const [filterEvent, setFilterEvent] = useState(urlParams.get("event") || "");
  const [filterProgram, setFilterProgram] = useState(urlParams.get("program") || "");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPay, setFilterPay] = useState("");
  const [regPage, setRegPage] = useState(1);
  const [regPerPage, setRegPerPage] = useState(10);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openAction) return;
    const handler = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node))
        setOpenAction(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openAction]);

  const programsForEvent = useMemo(() => {
    if (!filterEvent) return [];
    return events.find(e => e.id === filterEvent)?.programs || [];
  }, [events, filterEvent]);

  const filteredRegs = useMemo(() => regData.filter(r => {
    if (filterEvent && r.event !== filterEvent) return false;
    if (filterProgram && r.program !== filterProgram) return false;
    if (filterStatus && r.regStatus !== filterStatus) return false;
    if (filterPay && r.paymentStatus !== filterPay) return false;
    return true;
  }), [regData, filterEvent, filterProgram, filterStatus, filterPay]);

  const regSort = useSort(filteredRegs);
  const regTotalPages = Math.max(1, Math.ceil(regSort.sorted.length / regPerPage));
  const pagedRegs = regSort.sorted.slice((regPage - 1) * regPerPage, regPage * regPerPage);

  const [payments, setPayments] = useState(INIT_PAYMENTS);
  const [txnFilterEvent, setTxnFilterEvent] = useState("");
  const [txnFilterStatus, setTxnFilterStatus] = useState("");
  const [txnFilterMethod, setTxnFilterMethod] = useState("");
  const [txnPage, setTxnPage] = useState(1);
  const [txnPerPage, setTxnPerPage] = useState(10);

  const filteredTxns = useMemo(() => payments.filter(t => {
    if (txnFilterEvent && !t.event.toLowerCase().includes(txnFilterEvent.toLowerCase())) return false;
    if (txnFilterStatus && t.paymentStatus !== txnFilterStatus) return false;
    if (txnFilterMethod && t.method !== txnFilterMethod) return false;
    return true;
  }), [payments, txnFilterEvent, txnFilterStatus, txnFilterMethod]);

  const txnSort = useSort(filteredTxns);
  const txnTotalPages = Math.max(1, Math.ceil(txnSort.sorted.length / txnPerPage));
  const pagedTxns = txnSort.sorted.slice((txnPage - 1) * txnPerPage, txnPage * txnPerPage);

  const [markPaidModal, setMarkPaidModal] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<PaymentRecord | null>(null);
  const [receiptModal, setReceiptModal] = useState<PaymentRecord | null>(null);
  const [markPaidRemark, setMarkPaidRemark] = useState("");
  const [markPaidMethod, setMarkPaidMethod] = useState<PaymentMethod>("Credit Card");
  const [cancelReason, setCancelReason] = useState("");
  const [refundSelections, setRefundSelections] = useState<Record<string, { selected: boolean; reason: string }>>({});

  const handleMarkPaid = () => {
    if (!markPaidRemark.trim()) return;
    setRegData(prev => prev.map(r => r.id === markPaidModal ? { ...r, paymentStatus: "Paid", regStatus: "Confirmed" } : r));
    setPayments(prev => prev.map(p => p.registrationId === markPaidModal
      ? { ...p, method: markPaidMethod, paidDate: new Date().toISOString().slice(0, 10), receiptNumber: `RCP-${Date.now().toString().slice(-4)}`, paymentStatus: "Paid" } : p));
    setMarkPaidModal(null); setMarkPaidRemark(""); setMarkPaidMethod("Credit Card");
  };

  const handleCancelAndRefund = () => {
    if (!cancelReason.trim()) return;
    const reg = regData.find(r => r.id === cancelModal);
    const wasPaid = reg?.paymentStatus === "Paid";
    setRegData(prev => prev.map(r => r.id === cancelModal ? { ...r, regStatus: "Cancelled", paymentStatus: wasPaid ? "Refunded" : r.paymentStatus } : r));
    if (wasPaid) {
      const today = new Date().toISOString().slice(0, 10);
      setPayments(prev => prev.map(p => {
        if (p.registrationId !== cancelModal) return p;
        return { ...p, lineItems: p.lineItems.map(li => ({ ...li, refundedAmount: li.amount, refundStatus: "Full" as const, refundDate: today, refundReason: `Cancelled: ${cancelReason}` })), paymentStatus: "Refunded" };
      }));
    }
    setCancelModal(null); setCancelReason("");
  };

  const handleRefund = () => {
    if (!refundModal) return;
    const today = new Date().toISOString().slice(0, 10);
    setPayments(prev => prev.map(p => {
      if (p.id !== refundModal.id) return p;
      const updatedItems = p.lineItems.map(li => {
        const sel = refundSelections[li.id];
        if (!sel?.selected || !sel.reason.trim()) return li;
        return { ...li, refundedAmount: li.amount, refundStatus: "Full" as const, refundDate: today, refundReason: sel.reason };
      });
      const allRefunded = updatedItems.every(li => li.refundStatus === "Full");
      const someRefunded = updatedItems.some(li => li.refundStatus === "Full");
      return { ...p, lineItems: updatedItems, paymentStatus: allRefunded ? "Refunded" : someRefunded ? "Partially Refunded" : p.paymentStatus };
    }));
    setRefundModal(null); setRefundSelections({});
  };

  function SortBtn<T>({ col, ctrl }: { col: keyof T; ctrl: ReturnType<typeof useSort<T>> }) {
    const active = ctrl.sort.key === col;
    return (
      <button onClick={() => ctrl.toggle(col)} className="ml-1 inline-flex align-middle opacity-50 hover:opacity-100">
        {!active ? <ChevronsUpDown className="h-3 w-3" /> : ctrl.sort.dir === "asc" ? <ChevronUp className="h-3 w-3" style={{ color: "var(--color-primary)" }} /> : <ChevronDown className="h-3 w-3" style={{ color: "var(--color-primary)" }} />}
      </button>
    );
  }

  return (
    <div>
      <div className="sticky-header">
        <h1 className="font-bold text-2xl mb-6">Registrations & Payments</h1>

        {/* Tabs */}
        <div className="tab-bar mb-6">
          {(["registrations", "payments"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}>
              {tab === "registrations" ? "Registration List" : "Payment Transaction Log"}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ REGISTRATIONS TAB ═══ */}
      {activeTab === "registrations" && (
        <>
          <div className="p-5 mb-5" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="grid grid-cols-2 md:flex md:flex-wrap items-end gap-4">
              <FG label="Event *">
                <select className="field-input w-full md:w-56" value={filterEvent}
                  onChange={e => { setFilterEvent(e.target.value); setFilterProgram(""); setRegPage(1); }}>
                  <option value="">— Select an event —</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </FG>
              <FG label="Program">
                <select className="field-input w-full md:w-48" value={filterProgram} disabled={!filterEvent}
                  onChange={e => { setFilterProgram(e.target.value); setRegPage(1); }}>
                  <option value="">All Programs</option>
                  {programsForEvent.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FG>
              <FG label="Reg. Status">
                <select className="field-input w-full md:w-36" value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setRegPage(1); }}>
                  <option value="">All</option><option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending</option><option value="Cancelled">Cancelled</option>
                </select>
              </FG>
              <FG label="Payment">
                <select className="field-input w-full md:w-36" value={filterPay}
                  onChange={e => { setFilterPay(e.target.value); setRegPage(1); }}>
                  <option value="">All</option><option value="Paid">Paid</option>
                  <option value="Pending">Pending</option><option value="Refunded">Refunded</option>
                </select>
              </FG>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block" style={{ border: "1px solid var(--color-table-border)" }}>
            <div className="overflow-x-auto">
              <table className="trs-table">
                <thead>
                  <tr>
                    <th>ID <SortBtn<Reg> col="id" ctrl={regSort} /></th>
                    <th>Club / Participant <SortBtn<Reg> col="club" ctrl={regSort} /></th>
                    <th>Program <SortBtn<Reg> col="programName" ctrl={regSort} /></th>
                    <th>Payment <SortBtn<Reg> col="paymentStatus" ctrl={regSort} /></th>
                    <th>Reg. Status <SortBtn<Reg> col="regStatus" ctrl={regSort} /></th>
                    <th>Amount <SortBtn<Reg> col="amount" ctrl={regSort} /></th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRegs.map(reg => {
                    const canMarkPaid = reg.paymentStatus === "Pending" && reg.regStatus !== "Cancelled";
                    const canRefund = reg.paymentStatus === "Paid" && reg.regStatus !== "Cancelled";
                    const canCancel = reg.regStatus !== "Cancelled";
                    const payment = payments.find(p => p.registrationId === reg.id);
                    return (
                      <tr key={reg.id}>
                        <td className="font-mono text-xs">{reg.id}</td>
                        <td><p className="font-semibold text-sm">{reg.club}</p><p className="text-xs opacity-60 mt-0.5">{reg.name}</p></td>
                        <td className="text-sm">{reg.programName}</td>
                        <td><PayBadge status={reg.paymentStatus} /></td>
                        <td><RegBadge status={reg.regStatus} /></td>
                        <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>${reg.amount.toFixed(2)}</td>
                        <td>
                          <div className="relative" ref={openAction === reg.id ? actionRef : undefined}>
                            <button onClick={() => setOpenAction(openAction === reg.id ? null : reg.id)}
                              className="p-2 hover:opacity-70 transition-opacity" style={{ color: "var(--color-primary)" }}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openAction === reg.id && (
                              <div className="action-dropdown">
                                <button disabled={!canMarkPaid} onClick={() => { setMarkPaidModal(reg.id); setOpenAction(null); }}>
                                  <CheckCircle className="h-4 w-4" /> Mark as Paid
                                </button>
                                <button disabled={!canRefund} onClick={() => { const p = payments.find(px => px.registrationId === reg.id); if (p) { setRefundModal(p); setRefundSelections({}); } setOpenAction(null); }}>
                                  <RefreshCw className="h-4 w-4" /> Refund
                                </button>
                                <button disabled={!canCancel} onClick={() => { setCancelModal(reg.id); setOpenAction(null); }}
                                  style={{ color: canCancel ? "var(--badge-open-text)" : undefined }}>
                                  <XCircle className="h-4 w-4" /> Cancel
                                </button>
                                {payment?.receiptNumber && (
                                  <button onClick={() => { setReceiptModal(payment); setOpenAction(null); }}>
                                    <Receipt className="h-4 w-4" /> View Receipt
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedRegs.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 opacity-40">{filterEvent ? "No registrations found." : "Select an event to view registrations."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={regPage} totalPages={regTotalPages} perPage={regPerPage} total={filteredRegs.length} setPage={setRegPage} setPerPage={n => { setRegPerPage(n); setRegPage(1); }} />
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {pagedRegs.map(reg => {
              const canMarkPaid = reg.paymentStatus === "Pending" && reg.regStatus !== "Cancelled";
              const canRefund = reg.paymentStatus === "Paid" && reg.regStatus !== "Cancelled";
              const canCancel = reg.regStatus !== "Cancelled";
              const payment = payments.find(p => p.registrationId === reg.id);
              return (
                <div key={reg.id} className="p-5" style={{ border: "1px solid var(--color-table-border)" }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{reg.club}</p>
                      <p className="text-xs opacity-60">{reg.name}</p>
                    </div>
                    <div className="relative">
                      <button onClick={() => setOpenAction(openAction === reg.id ? null : reg.id)} className="p-1.5 opacity-50 hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openAction === reg.id && (
                        <div className="action-dropdown">
                          {canMarkPaid && <button onClick={() => { setMarkPaidModal(reg.id); setOpenAction(null); }}>Mark as Paid</button>}
                          {canRefund && <button onClick={() => { const p = payments.find(px => px.registrationId === reg.id); if (p) { setRefundModal(p); setRefundSelections({}); } setOpenAction(null); }}>Refund</button>}
                          {canCancel && <button onClick={() => { setCancelModal(reg.id); setOpenAction(null); }} style={{ color: "var(--badge-open-text)" }}>Cancel</button>}
                          {payment?.receiptNumber && <button onClick={() => { setReceiptModal(payment); setOpenAction(null); }}>View Receipt</button>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <PayBadge status={reg.paymentStatus} /><RegBadge status={reg.regStatus} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-70">{reg.programName}</span>
                    <span className="font-bold" style={{ color: "var(--color-primary)" }}>${reg.amount.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
            {pagedRegs.length === 0 && <p className="text-center py-10 opacity-40">{filterEvent ? "No registrations." : "Select an event."}</p>}
            <Pagination page={regPage} totalPages={regTotalPages} perPage={regPerPage} total={filteredRegs.length} setPage={setRegPage} setPerPage={n => { setRegPerPage(n); setRegPage(1); }} />
          </div>
        </>
      )}

      {/* ═══ PAYMENTS TAB ═══ */}
      {activeTab === "payments" && (
        <>
          <div className="p-5 mb-5" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
            <div className="grid grid-cols-2 md:flex md:flex-wrap items-end gap-4">
              <FG label="Event"><input className="field-input w-full md:w-52" placeholder="Search event..." value={txnFilterEvent} onChange={e => { setTxnFilterEvent(e.target.value); setTxnPage(1); }} /></FG>
              <FG label="Payment Status">
                <select className="field-input w-full md:w-44" value={txnFilterStatus} onChange={e => { setTxnFilterStatus(e.target.value); setTxnPage(1); }}>
                  <option value="">All</option><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Refunded">Refunded</option><option value="Partially Refunded">Partially Refunded</option>
                </select>
              </FG>
              <FG label="Method">
                <select className="field-input w-full md:w-40" value={txnFilterMethod} onChange={e => { setTxnFilterMethod(e.target.value); setTxnPage(1); }}>
                  <option value="">All</option><option value="Credit Card">Credit Card</option><option value="PayNow">PayNow</option><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Others">Others</option>
                </select>
              </FG>
            </div>
          </div>

          {/* Desktop payments table */}
          <div className="hidden md:block" style={{ border: "1px solid var(--color-table-border)" }}>
            <div className="overflow-x-auto">
              <table className="trs-table">
                <thead><tr><th>Receipt</th><th>Event / Program</th><th>Participant</th><th>Method</th><th>Total</th><th>Refunded</th><th>Status</th><th>Paid</th><th>Actions</th></tr></thead>
                <tbody>
                  {pagedTxns.map(txn => {
                    const totalRefunded = txn.lineItems.reduce((s, li) => s + li.refundedAmount, 0);
                    const totalAmount = txn.lineItems.reduce((s, li) => s + li.amount, 0);
                    return (
                      <tr key={txn.id}>
                        <td className="font-mono text-xs">{txn.receiptNumber || <span className="opacity-30">—</span>}</td>
                        <td><p className="text-sm font-medium">{txn.event}</p><p className="text-xs opacity-60">{txn.program}</p></td>
                        <td className="text-sm">{txn.participants}</td>
                        <td><span className="inline-flex items-center gap-1.5 text-sm"><MethodIcon method={txn.method} />{txn.method}</span></td>
                        <td className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>${totalAmount.toFixed(2)}</td>
                        <td className="text-sm">{totalRefunded > 0 ? <span style={{ color: "var(--badge-open-text)" }}>${totalRefunded.toFixed(2)}</span> : <span className="opacity-30">—</span>}</td>
                        <td><PayBadge status={txn.paymentStatus} /></td>
                        <td className="text-xs opacity-70">{txn.paidDate || "—"}</td>
                        <td>
                          <button title="Details" onClick={() => setReceiptModal(txn)} className="p-2 hover:opacity-60" style={{ color: "var(--color-primary)" }}>
                            <Receipt className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedTxns.length === 0 && <tr><td colSpan={9} className="text-center py-10 opacity-40">No transactions found.</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={txnPage} totalPages={txnTotalPages} perPage={txnPerPage} total={filteredTxns.length} setPage={setTxnPage} setPerPage={n => { setTxnPerPage(n); setTxnPage(1); }} />
          </div>

          {/* Mobile payments cards */}
          <div className="md:hidden space-y-3">
            {pagedTxns.map(txn => {
              const totalAmount = txn.lineItems.reduce((s, li) => s + li.amount, 0);
              return (
                <div key={txn.id} className="p-5" style={{ border: "1px solid var(--color-table-border)" }}
                  onClick={() => setReceiptModal(txn)}>
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="text-sm font-medium">{txn.event}</p><p className="text-xs opacity-60">{txn.program} · {txn.participants}</p></div>
                    <PayBadge status={txn.paymentStatus} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-60">{txn.method} · {txn.paidDate || "Unpaid"}</span>
                    <span className="font-bold" style={{ color: "var(--color-primary)" }}>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
            {pagedTxns.length === 0 && <p className="text-center py-10 opacity-40">No transactions.</p>}
            <Pagination page={txnPage} totalPages={txnTotalPages} perPage={txnPerPage} total={filteredTxns.length} setPage={setTxnPage} setPerPage={n => { setTxnPerPage(n); setTxnPage(1); }} />
          </div>
        </>
      )}

      {/* ═══ MODALS ═══ */}
      {/* Mark as Paid */}
      <Dialog open={!!markPaidModal} onOpenChange={v => { if (!v) { setMarkPaidModal(null); setMarkPaidRemark(""); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="sticky top-0 p-8 pb-4 z-10" style={{ backgroundColor: "var(--color-page-bg)", borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-xl">Mark as Paid</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <FG label="Payment Method *"><select className="field-input" value={markPaidMethod} onChange={e => setMarkPaidMethod(e.target.value as PaymentMethod)}>
              <option value="Credit Card">Credit Card</option><option value="PayNow">PayNow</option><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Others">Others</option>
            </select></FG>
            <FG label="Remark *"><textarea className="field-input" rows={3} value={markPaidRemark} onChange={e => setMarkPaidRemark(e.target.value)} placeholder="e.g. Cash collected" /></FG>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setMarkPaidModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleMarkPaid} disabled={!markPaidRemark.trim()} className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Confirm Payment</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={!!cancelModal} onOpenChange={v => { if (!v) { setCancelModal(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="sticky top-0 p-8 pb-4 z-10" style={{ backgroundColor: "var(--color-page-bg)", borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-xl">Cancel Registration</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <div className="p-3 text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>If paid, a refund will be triggered automatically.</div>
            <FG label="Reason *"><textarea className="field-input" rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Enter reason..." /></FG>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setCancelModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Close</button>
            <button onClick={handleCancelAndRefund} disabled={!cancelReason.trim()} className="px-5 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: "var(--badge-open-text)", color: "var(--color-hero-text)" }}>Confirm Cancel</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund */}
      <Dialog open={!!refundModal} onOpenChange={v => { if (!v) { setRefundModal(null); setRefundSelections({}); } }}>
        <DialogContent className="max-w-lg p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="sticky top-0 p-8 pb-4 z-10" style={{ backgroundColor: "var(--color-page-bg)", borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-xl">Process Refund</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-5">
            <div className="p-3 text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>Selected items will be refunded. Each requires a reason.</div>
            {refundModal?.lineItems.map(li => (
              <div key={li.id} className="p-4 space-y-3" style={{ border: "1px solid var(--color-table-border)" }}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Switch disabled={li.refundStatus === "Full"} checked={refundSelections[li.id]?.selected || false}
                    onCheckedChange={checked => setRefundSelections(prev => ({ ...prev, [li.id]: { selected: !!checked, reason: prev[li.id]?.reason || "" } }))} />
                  <div className="flex-1"><div className="flex items-center justify-between"><span className="text-sm font-medium">{li.label}</span><span className="font-bold text-sm ml-3" style={{ color: "var(--color-primary)" }}>${li.amount.toFixed(2)}</span></div>
                    {li.refundStatus === "Full" && <p className="text-xs mt-1 opacity-50">Already refunded on {li.refundDate}</p>}</div>
                </label>
                {refundSelections[li.id]?.selected && (
                  <div><label className="block text-xs font-semibold mb-1.5 opacity-70">Reason *</label>
                    <input className="field-input" placeholder="e.g. Participant withdrew" value={refundSelections[li.id]?.reason || ""}
                      onChange={e => setRefundSelections(prev => ({ ...prev, [li.id]: { ...prev[li.id], reason: e.target.value } }))} /></div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => setRefundModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Close</button>
            <button onClick={handleRefund} disabled={!Object.values(refundSelections).some(s => s.selected && s.reason.trim())}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40">Process Refund</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={!!receiptModal} onOpenChange={v => { if (!v) setReceiptModal(null); }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="sticky top-0 p-8 pb-4 z-10" style={{ backgroundColor: "var(--color-page-bg)", borderBottom: "1px solid var(--color-table-border)" }}>
            <DialogTitle className="font-bold text-xl">{receiptModal?.receiptNumber ? `Receipt ${receiptModal.receiptNumber}` : "Payment Details"}</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="opacity-50 text-xs">Transaction ID</p><p className="font-mono">{receiptModal?.id}</p></div>
              <div><p className="opacity-50 text-xs">Method</p><p>{receiptModal?.method}</p></div>
              <div><p className="opacity-50 text-xs">Paid Date</p><p>{receiptModal?.paidDate || "—"}</p></div>
              <div><p className="opacity-50 text-xs">Status</p>{receiptModal && <PayBadge status={receiptModal.paymentStatus} />}</div>
            </div>
            <div className="pt-2" style={{ borderTop: "1px solid var(--color-table-border)" }}>
              <p className="text-xs font-bold uppercase tracking-wide opacity-50 mb-3">Line Items</p>
              {receiptModal?.lineItems.map(li => (
                <div key={li.id} className="mb-3 p-3" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                  <div className="flex items-start justify-between gap-2"><span className="text-sm flex-1">{li.label}</span><span className="font-bold text-sm" style={{ color: "var(--color-primary)" }}>${li.amount.toFixed(2)}</span></div>
                  {li.refundStatus !== "None" && <div className="mt-2 text-xs space-y-0.5" style={{ color: "var(--badge-open-text)" }}><p>Refunded: ${li.refundedAmount.toFixed(2)} on {li.refundDate}</p><p className="opacity-70">Reason: {li.refundReason}</p></div>}
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-bold text-sm" style={{ borderTop: "1px solid var(--color-table-border)" }}>
                <span>Total Paid</span><span style={{ color: "var(--color-primary)" }}>${receiptModal?.lineItems.reduce((s, li) => s + li.amount, 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 pt-0"><button onClick={() => setReceiptModal(null)} className="btn-outline px-5 py-2.5 text-sm font-medium">Close</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FG({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="block text-xs font-semibold mb-1.5 opacity-60">{label}</label>{children}</div>);
}

function PayBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; text: string }> = {
    "Paid": { bg: "var(--badge-open-bg)", text: "var(--badge-open-text)" },
    "Pending": { bg: "var(--badge-soon-bg)", text: "var(--badge-soon-text)" },
    "Refunded": { bg: "var(--badge-closed-bg)", text: "var(--badge-closed-text)" },
    "Partially Refunded": { bg: "var(--badge-soon-bg)", text: "var(--badge-soon-text)" },
  };
  const s = m[status] ?? m["Pending"];
  return <span className="inline-flex px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>{status}</span>;
}

function RegBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; text: string }> = {
    "Confirmed": { bg: "var(--badge-open-bg)", text: "var(--badge-open-text)" },
    "Pending": { bg: "var(--badge-soon-bg)", text: "var(--badge-soon-text)" },
    "Cancelled": { bg: "var(--badge-closed-bg)", text: "var(--badge-closed-text)" },
  };
  const s = m[status] ?? m["Pending"];
  return <span className="inline-flex px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>{status}</span>;
}

function MethodIcon({ method }: { method: string }) {
  if (method === "Credit Card") return <CreditCard className="h-3.5 w-3.5 opacity-60" />;
  if (method === "PayNow") return <span className="text-xs font-bold px-1" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>PN</span>;
  return <span className="text-xs opacity-50">—</span>;
}
