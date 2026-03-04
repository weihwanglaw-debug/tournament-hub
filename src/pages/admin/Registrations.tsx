import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, CheckCircle, XCircle, RefreshCw, Filter } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent } from "@/types/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const sampleRegistrations = [
  { id: "R001", name: "John Tan", event: "evt-1", program: "Men's Singles", paymentStatus: "Paid", regStatus: "Confirmed", amount: 80 },
  { id: "R002", name: "Sarah Lee", event: "evt-1", program: "Women's Singles", paymentStatus: "Pending", regStatus: "Pending", amount: 80 },
  { id: "R003", name: "David Lim & Alice Wong", event: "evt-1", program: "Mixed Doubles", paymentStatus: "Paid", regStatus: "Confirmed", amount: 120 },
  { id: "R004", name: "Michael Ng", event: "evt-2", program: "Boys U15 Singles", paymentStatus: "Paid", regStatus: "Confirmed", amount: 40 },
  { id: "R005", name: "Rachel Tan", event: "evt-2", program: "Girls U15 Singles", paymentStatus: "Refunded", regStatus: "Cancelled", amount: 40 },
];

const sampleTransactions = [
  { id: "TXN-001", event: "Singapore Open 2026", participants: "John Tan", method: "Credit Card", amount: 80, paymentStatus: "Paid", refundStatus: "—", date: "2026-02-10" },
  { id: "TXN-002", event: "Singapore Open 2026", participants: "Sarah Lee", method: "PayNow", amount: 80, paymentStatus: "Pending", refundStatus: "—", date: "2026-02-11" },
  { id: "TXN-003", event: "Singapore Open 2026", participants: "David Lim, Alice Wong", method: "Credit Card", amount: 120, paymentStatus: "Paid", refundStatus: "—", date: "2026-02-12" },
  { id: "TXN-004", event: "Junior Tournament 2026", participants: "Rachel Tan", method: "Credit Card", amount: 40, paymentStatus: "Refunded", refundStatus: "Full Refund", date: "2026-02-15" },
];

export default function AdminRegistrations() {
  const [params] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"registrations" | "payments">("registrations");
  const [filterEvent, setFilterEvent] = useState(params.get("event") || "");
  const [filterStatus, setFilterStatus] = useState("");
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundItems, setRefundItems] = useState<string[]>([]);

  const events = config.events as TournamentEvent[];

  const filteredRegistrations = sampleRegistrations.filter((r) => {
    if (filterEvent && r.event !== filterEvent) return false;
    if (filterStatus && r.regStatus !== filterStatus) return false;
    return true;
  });

  const handleConfirm = (id: string) => {
    // In real app, update backend
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    // Record: reason, timestamp, admin
    setCancelModal(null);
    setCancelReason("");
  };

  const handleRefund = () => {
    if (!refundReason.trim() || refundItems.length === 0) return;
    // Record: reason, timestamp, admin, gateway refund ID
    setRefundModal(null);
    setRefundReason("");
    setRefundItems([]);
  };

  return (
    <div>
      <h1 className="font-heading font-bold text-2xl mb-8">Registrations & Payments</h1>

      {/* Tabs */}
      <div className="flex gap-0 mb-8" style={{ borderBottom: "2px solid var(--color-table-border)" }}>
        {(["registrations", "payments"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-6 py-3 text-sm font-semibold transition-colors relative"
            style={{
              color: activeTab === tab ? "var(--color-primary)" : "var(--color-body-text)",
              borderBottom: activeTab === tab ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: "-2px",
            }}
          >
            {tab === "registrations" ? "Registration List" : "Payment Transaction Log"}
          </button>
        ))}
      </div>

      {activeTab === "registrations" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 opacity-50" />
              <select className="field-input w-52" value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
                <option value="">All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
            <select className="field-input w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Participant</th>
                  <th>Program</th>
                  <th className="text-center">Payment</th>
                  <th className="text-center">Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.map((reg) => (
                  <tr key={reg.id}>
                    <td className="font-mono text-xs">{reg.id}</td>
                    <td className="font-medium">{reg.name}</td>
                    <td>{reg.program}</td>
                    <td className="text-center">
                      <PaymentBadge status={reg.paymentStatus} />
                    </td>
                    <td className="text-center">
                      <span className="text-xs font-semibold">{reg.regStatus}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleConfirm(reg.id)}
                          className="p-2 hover:bg-black/5 transition-colors"
                          title="Confirm"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setCancelModal(reg.id)}
                          className="p-2 hover:bg-black/5 transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setRefundModal(reg.id)}
                          className="p-2 hover:bg-black/5 transition-colors"
                          title="Refund"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRegistrations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 opacity-40">
                      No registrations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "payments" && (
        <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
          <table className="trs-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Event</th>
                <th>Participant(s)</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Payment</th>
                <th className="text-center">Refund</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {sampleTransactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="font-mono text-xs">{txn.id}</td>
                  <td>{txn.event}</td>
                  <td className="font-medium">{txn.participants}</td>
                  <td>{txn.method}</td>
                  <td className="text-right font-semibold" style={{ color: "var(--color-primary)" }}>${txn.amount}</td>
                  <td className="text-center">
                    <PaymentBadge status={txn.paymentStatus} />
                  </td>
                  <td className="text-center text-xs">{txn.refundStatus}</td>
                  <td className="text-sm">{txn.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel Modal */}
      <Dialog open={!!cancelModal} onOpenChange={(v) => { if (!v) { setCancelModal(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-heading font-bold text-xl">Cancel Registration</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4">
            <label className="block text-xs font-semibold mb-2 opacity-70">Reason for cancellation *</label>
            <textarea
              className="field-input"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter reason..."
            />
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => { setCancelModal(null); setCancelReason(""); }} className="btn-outline px-5 py-2.5 text-sm font-medium">
              Close
            </button>
            <button
              onClick={handleCancel}
              disabled={!cancelReason.trim()}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Modal */}
      <Dialog open={!!refundModal} onOpenChange={(v) => { if (!v) { setRefundModal(null); setRefundReason(""); setRefundItems([]); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="font-heading font-bold text-xl">Initiate Refund</DialogTitle>
          </DialogHeader>
          <div className="p-8 pt-4 space-y-5">
            <div>
              <h3 className="text-xs font-semibold mb-3 opacity-70">Select items to refund</h3>
              {[{ id: "item-1", label: "Registration Fee", amount: 80 }].map((item) => (
                <label key={item.id} className="flex items-center justify-between p-3 cursor-pointer text-sm" style={{ border: "1px solid var(--color-table-border)" }}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={refundItems.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) setRefundItems((prev) => [...prev, item.id]);
                        else setRefundItems((prev) => prev.filter((i) => i !== item.id));
                      }}
                    />
                    {item.label}
                  </div>
                  <span className="font-semibold" style={{ color: "var(--color-primary)" }}>${item.amount}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Refund Reason *</label>
              <textarea
                className="field-input"
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason..."
              />
            </div>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => { setRefundModal(null); setRefundReason(""); setRefundItems([]); }} className="btn-outline px-5 py-2.5 text-sm font-medium">
              Close
            </button>
            <button
              onClick={handleRefund}
              disabled={!refundReason.trim() || refundItems.length === 0}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Process Refund
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Paid: { bg: "var(--badge-open-bg)", text: "var(--badge-open-text)" },
    Pending: { bg: "var(--badge-soon-bg)", text: "var(--badge-soon-text)" },
    Refunded: { bg: "var(--badge-closed-bg)", text: "var(--badge-closed-text)" },
  };
  const s = map[status] || map.Pending;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
      <CreditCard className="h-3 w-3" /> {status}
    </span>
  );
}
