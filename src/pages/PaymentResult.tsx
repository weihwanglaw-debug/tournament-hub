/**
 * PaymentResult.tsx — Shown after gateway redirect (Stripe hosted checkout).
 *
 * Query params:
 *   ?status=success|cancel   — gateway outcome
 *   ?reg=REG-XXX             — registration ID written by apiInitiateCheckout()
 *
 * On success: fetches the real registration to display the actual receipt number,
 * contact name, and program summary.
 *
 * MOCK → REAL: no changes needed here. The reg ID is always in the URL and
 * apiGetRegistration() transparently returns mock or real data.
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { apiGetRegistration } from "@/lib/api";
import type { Registration } from "@/lib/api";

export default function PaymentResult() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const status     = params.get("status");
  const regId      = params.get("reg");
  const isSuccess  = status === "success";

  const [reg,     setReg]     = useState<Registration | null>(null);
  const [loading, setLoading] = useState(isSuccess && !!regId);

  useEffect(() => {
    if (!isSuccess || !regId) { setLoading(false); return; }
    apiGetRegistration(regId).then(res => {
      if (res.data) setReg(res.data);
      setLoading(false);
    });
  }, [regId, isSuccess]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16 flex items-center justify-center px-8"
        style={{ backgroundColor: "var(--color-page-bg)" }}>
        <motion.div
          className="max-w-md w-full text-center py-20"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {isSuccess ? (
            <>
              <CheckCircle className="h-16 w-16 mx-auto mb-5"
                style={{ color: "var(--color-primary)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Registration Confirmed!</h1>

              {loading ? (
                <div className="flex items-center justify-center gap-2 opacity-40 my-6">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading your receipt…</span>
                </div>
              ) : reg ? (
                <>
                  {/* Real receipt number from the registration */}
                  <p className="text-sm opacity-70 mb-2">
                    Receipt Number:{" "}
                    <span className="font-mono font-semibold">
                      {reg.payment.receiptNo || "—"}
                    </span>
                  </p>
                  <p className="text-sm opacity-60 mb-1">{reg.contactName}</p>
                  <p className="text-sm opacity-50 mb-6">
                    {reg.groups.map(g => g.programName).join(" · ")}
                  </p>
                </>
              ) : (
                // Fallback if reg couldn't be fetched (e.g. network error)
                <p className="text-sm opacity-60 mb-8">
                  A confirmation email has been sent with your receipt.
                </p>
              )}

              <p className="text-sm opacity-50 mb-8">
                You may download your receipt below.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button className="btn-primary px-6 py-2.5 text-sm font-semibold">
                  Download Receipt
                </button>
                <button onClick={() => navigate("/")}
                  className="btn-outline px-6 py-2.5 text-sm font-medium">
                  Back to Home
                </button>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 mx-auto mb-5"
                style={{ color: "var(--badge-open-text)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Payment Unsuccessful</h1>
              <p className="text-sm opacity-70 mb-8">
                Something went wrong with your payment. Please try again or contact support.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => navigate(-1)}
                  className="btn-primary px-6 py-2.5 text-sm font-semibold">
                  Try Again
                </button>
                <button onClick={() => navigate("/")}
                  className="btn-outline px-6 py-2.5 text-sm font-medium">
                  Back to Home
                </button>
              </div>
            </>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}