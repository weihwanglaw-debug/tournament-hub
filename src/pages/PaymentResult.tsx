/**
 * PaymentResult.tsx
 *
 * Landing page after Stripe redirects back.
 * Reads ?reg=REG-001 from URL, polls apiGetRegistration() until
 * Payment.paymentStatus = "Success" (webhook may take a few seconds).
 *
 * Public page — no login required.
 * Mock:  reads from in-memory store
 * Real:  swap registrationsApi.ts body — no changes here
 */

import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { apiGetRegistration } from "@/lib/api";
import { API_BASE } from "@/lib/api/_base";
import type { Registration } from "@/lib/api";

export default function PaymentResult() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const status    = params.get("status");
  const regId     = params.get("reg");
  const isSuccess = status !== "cancel" && status !== "failed";

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading,      setLoading]      = useState(isSuccess && !!regId);
  const [pollCount,    setPollCount]    = useState(0);

  useEffect(() => {
    if (!isSuccess || !regId) return;

    let cancelled = false;
    let attempts  = 0;
    const MAX_ATTEMPTS = 10;       // ~15 seconds total
    const INITIAL_DELAY = 1000;    // 1s — webhook usually lands within this
    const RETRY_INTERVAL = 1500;   // 1.5s between retries

    const poll = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const r = await apiGetRegistration(regId);
        if (cancelled) return;

        if (r.data) {
          setRegistration(r.data);
          // If payment confirmed, stop polling immediately
          if (r.data.payment.paymentStatus === "Success" || attempts >= MAX_ATTEMPTS) {
            setLoading(false);
            return;
          }
        }
      } catch {
        // Network error — keep polling until max attempts
      }

      if (attempts < MAX_ATTEMPTS) {
        setPollCount(attempts);
        setTimeout(poll, RETRY_INTERVAL);
      } else {
        setLoading(false);
      }
    };

    // Brief initial delay for webhook to land
    setTimeout(poll, INITIAL_DELAY);
    return () => { cancelled = true; };
  }, [isSuccess, regId]);

  const receiptNo = registration?.payment.receiptNo
    ?? (regId ? `TRS-${regId}` : "—");

  const isConfirmed = registration?.payment.paymentStatus === "Success";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16 flex items-center justify-center px-8"
        style={{ backgroundColor: "var(--color-page-bg)" }}>
        <motion.div className="max-w-md w-full text-center py-20"
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>

          {loading ? (
            <>
              <Loader2 className="h-12 w-12 mx-auto mb-5 animate-spin opacity-40" />
              <p className="text-sm opacity-50 mb-1">Confirming your registration…</p>
              {pollCount > 2 && (
                <p className="text-xs opacity-30">This may take a moment</p>
              )}
            </>
          ) : isSuccess && isConfirmed ? (
            <>
              <CheckCircle className="h-16 w-16 mx-auto mb-5" style={{ color: "var(--color-primary)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Registration Confirmed!</h1>
              <p className="text-sm opacity-70 mb-2">
                Receipt Number: <span className="font-mono font-semibold">{receiptNo}</span>
              </p>
              {registration && (
                <p className="text-xs opacity-50 mb-1">
                  {registration.groups.map(g => g.programName).join(" · ")}
                </p>
              )}
              <p className="text-sm opacity-60 mb-8">
                A confirmation email has been sent with your tournament details.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  className="btn-primary px-6 py-2.5 text-sm font-semibold"
                  onClick={() => window.open(`${API_BASE}/api/registrations/${regId}/receipt`, "_blank")}>
                  Download Receipt
                </button>
                <button onClick={() => navigate("/")} className="btn-outline px-6 py-2.5 text-sm font-medium">
                  Back to Home
                </button>
              </div>
            </>
          ) : isSuccess && !isConfirmed ? (
            // Loaded but webhook hasn't confirmed yet after max polls
            <>
              <Loader2 className="h-12 w-12 mx-auto mb-5 opacity-40" />
              <h1 className="font-heading font-bold text-2xl mb-3">Processing Payment</h1>
              <p className="text-sm opacity-70 mb-2">
                {regId && <span>Registration ID: <span className="font-mono">{regId}</span></span>}
              </p>
              <p className="text-sm opacity-60 mb-8">
                Your payment is being processed. If you paid successfully, you will receive
                a confirmation email shortly. You can safely close this page.
              </p>
              <button onClick={() => navigate("/")} className="btn-outline px-6 py-2.5 text-sm font-medium">
                Back to Home
              </button>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 mx-auto mb-5" style={{ color: "var(--badge-open-text)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Payment Cancelled</h1>
              <p className="text-sm opacity-70 mb-8">
                Your registration has not been confirmed. No payment was taken.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => navigate(-1)} className="btn-primary px-6 py-2.5 text-sm font-semibold">
                  Try Again
                </button>
                <button onClick={() => navigate("/")} className="btn-outline px-6 py-2.5 text-sm font-medium">
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