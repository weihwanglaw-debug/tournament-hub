import { CreditCard, CheckCircle, XCircle, RefreshCw } from "lucide-react";

const sampleRegistrations = [
  { id: "R001", name: "John Tan", program: "Men's Singles", paymentStatus: "Paid", regStatus: "Confirmed" },
  { id: "R002", name: "Sarah Lee", program: "Women's Singles", paymentStatus: "Pending", regStatus: "Pending" },
  { id: "R003", name: "David Lim & Alice Wong", program: "Mixed Doubles", paymentStatus: "Paid", regStatus: "Confirmed" },
  { id: "R004", name: "Michael Ng", program: "Boys U15 Singles", paymentStatus: "Paid", regStatus: "Confirmed" },
  { id: "R005", name: "Rachel Tan", program: "Girls U15 Singles", paymentStatus: "Refunded", regStatus: "Cancelled" },
];

export default function AdminRegistrations() {
  return (
    <div>
      <h1 className="font-heading font-bold text-2xl mb-6">Registrations & Payments</h1>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-table-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}>
              <th className="text-left px-4 py-3 font-semibold">ID</th>
              <th className="text-left px-4 py-3 font-semibold">Participant</th>
              <th className="text-left px-4 py-3 font-semibold">Program</th>
              <th className="text-center px-4 py-3 font-semibold">Payment</th>
              <th className="text-center px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sampleRegistrations.map((reg) => (
              <tr
                key={reg.id}
                style={{ borderBottom: "1px solid var(--color-table-border)" }}
                className="transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-row-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <td className="px-4 py-3 font-mono text-xs">{reg.id}</td>
                <td className="px-4 py-3 font-medium">{reg.name}</td>
                <td className="px-4 py-3">{reg.program}</td>
                <td className="px-4 py-3 text-center">
                  <PaymentBadge status={reg.paymentStatus} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-semibold">{reg.regStatus}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded hover:bg-black/5" title="Confirm">
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-black/5" title="Cancel">
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-black/5" title="Refund">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
      <CreditCard className="h-3 w-3" /> {status}
    </span>
  );
}
