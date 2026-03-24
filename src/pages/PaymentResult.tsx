/**
 * PaymentResult.tsx
 *
 * Landing page after Stripe redirects back.
 *
 * ── SESSION-FIRST FLOW ────────────────────────────────────────────────────────
 * All registration data (cart, participants, contact person) is stored in
 * browser sessionStorage under key trs_cart_{eventId}. No DB record is created
 * before Stripe confirms payment.
 *
 * On SUCCESS (/payment/result?status=success&event={eventId}):
 *   1. Read gatewaySessionId + full payload from sessionStorage
 *   2. Call POST /api/registrations/confirm-session
 *      Backend: verifies payment with Stripe, writes Registration + Payment to DB,
 *      generates receipt, sends confirmation email, returns registrationId
 *   3. Poll GET /api/registrations/:id until paymentStatus = "Success"
 *   4. Clear sessionStorage, show receipt
 *
 * On CANCEL (/payment/result?status=cancel&event={eventId}):
 *   - No DB record was created — nothing to clean up
 *   - sessionStorage cart is intact
 *   - "Try Again" routes back to event page, cart auto-restores to Step 3
 *
 * Edge case — sessionStorage missing (different browser/device after payment):
 *   - confirm-session cannot be called without the payload
 *   - User is advised to check their email; organiser can verify manually
 *
 * Public page — no login required.
 */

import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { apiConfirmSession, apiGetRegistration } from "@/lib/api";
import { API_BASE } from "@/lib/api/_base";
import type { Registration } from "@/lib/api";

type Phase = "confirming" | "polling" | "done" | "cancelled" | "error";

export default function PaymentResult() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const status    = params.get("status");
  const eventId   = params.get("event");

  const isSuccess = status === "success";
  const isCancel  = status === "cancel" || status === "failed";

  const initialPhase: Phase = isSuccess ? "confirming" : isCancel ? "cancelled" : "done";

  const [phase,        setPhase]        = useState<Phase>(initialPhase);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [regId,        setRegId]        = useState<string | null>(null);
  const [errorMsg,     setErrorMsg]     = useState("");
  const [pollCount,    setPollCount]    = useState(0);

  // ── On success: read sessionStorage → call confirm-session → get regId ────
  useEffect(() => {
    if (!isSuccess) return;

    const SESSION_KEY = eventId ? `trs_cart_${eventId}` : null;

    // No session key means no eventId in URL — shouldn't happen in normal flow
    if (!SESSION_KEY) {
      setPhase("error");
      setErrorMsg("Missing event context. If your payment was successful you will receive a confirmation email. Otherwise please contact the organiser.");
      return;
    }

    let raw: string | null = null;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch { /* private mode */ }

    if (!raw) {
      // This happens if the user paid on a different browser/device or cleared storage.
      // We cannot confirm without the payload — advise them to check email.
      setPhase("error");
      setErrorMsg("Your registration details could not be retrieved from this browser. If your payment was successful you will receive a confirmation email shortly. Otherwise please contact the organiser.");
      return;
    }

    let session: { gatewaySessionId?: string; payload?: object } = {};
    try { session = JSON.parse(raw); } catch {
      setPhase("error");
      setErrorMsg("Session data could not be read. Please contact the organiser.");
      return;
    }

    if (!session.gatewaySessionId || !session.payload) {
      setPhase("error");
      setErrorMsg("Incomplete session data. Please contact the organiser.");
      return;
    }

    // Call backend to verify with Stripe and write to DB
    apiConfirmSession(session.gatewaySessionId, session.payload).then(r => {
      if (r.error) {
        setPhase("error");
        setErrorMsg(r.error.message);
        return;
      }
      // Clear session immediately — data is now safely in the DB
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      setRegId(r.data!.registrationId);
      setPhase("polling");
    });
  }, []); // run once on mount

  // ── Poll until registration is confirmed by webhook ───────────────────────
  useEffect(() => {
    if (phase !== "polling" || !regId) return;

    let cancelled = false;
    let attempts  = 0;
    const MAX_ATTEMPTS = 10;

    const poll = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const r = await apiGetRegistration(regId);
        if (cancelled) return;
        if (r.data) {
          setRegistration(r.data);
          if (r.data.payment.paymentStatus === "Success" || attempts >= MAX_ATTEMPTS) {
            setPhase("done");
            return;
          }
        }
      } catch { /* keep polling */ }

      if (attempts < MAX_ATTEMPTS) {
        setPollCount(attempts);
        setTimeout(poll, 1500);
      } else {
        setPhase("done");
      }
    };

    setTimeout(poll, 800);
    return () => { cancelled = true; };
  }, [phase, regId]);

  const isConfirmed = registration?.payment.paymentStatus === "Success";
  const receiptNo   = registration?.payment.receiptNo ?? (regId ? `TRS-${regId}` : "—");

  const handleTryAgain = () => {
    if (eventId) navigate(`/events/${eventId}`);
    else navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16 flex items-center justify-center px-8"
        style={{ backgroundColor: "var(--color-page-bg)" }}>
        <motion.div className="max-w-md w-full text-center py-20"
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>

          {/* Confirming / polling */}
          {(phase === "confirming" || phase === "polling") && (
            <>
              <Loader2 className="h-12 w-12 mx-auto mb-5 animate-spin opacity-40" />
              <p className="text-sm opacity-50 mb-1">
                {phase === "confirming" ? "Verifying your payment…" : "Finalising your registration…"}
              </p>
              {pollCount > 2 && <p className="text-xs opacity-30">This may take a moment</p>}
            </>
          )}

          {/* Success — confirmed */}
          {phase === "done" && isConfirmed && (
            <>
              <CheckCircle className="h-16 w-16 mx-auto mb-5" style={{ color: "var(--color-primary)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Registration Confirmed!</h1>
              <p className="text-sm opacity-70 mb-2">
                Receipt No: <span className="font-mono font-semibold">{receiptNo}</span>
              </p>
              {registration && (
                <p className="text-xs opacity-50 mb-1">
                  {registration.groups.map(g => g.programName).join(" · ")}
                </p>
              )}
              <p className="text-sm opacity-60 mb-8">
                A confirmation email has been sent to your registered contact email.
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
          )}

          {/* Done but still pending (webhook slow) */}
          {phase === "done" && !isConfirmed && !errorMsg && (
            <>
              <Loader2 className="h-12 w-12 mx-auto mb-5 opacity-40" />
              <h1 className="font-heading font-bold text-2xl mb-3">Payment Processing</h1>
              <p className="text-sm opacity-60 mb-8">
                Your payment is still being processed. If successful, you will receive
                a confirmation email shortly. You can safely close this page.
              </p>
              <button onClick={() => navigate("/")} className="btn-outline px-6 py-2.5 text-sm font-medium">
                Back to Home
              </button>
            </>
          )}

          {/* Error during confirm */}
          {phase === "error" && (
            <>
              <AlertCircle className="h-16 w-16 mx-auto mb-5 opacity-70" style={{ color: "var(--badge-soon-text)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Something Went Wrong</h1>
              <p className="text-sm opacity-70 mb-8">{errorMsg}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {eventId && (
                  <button onClick={handleTryAgain} className="btn-primary px-6 py-2.5 text-sm font-semibold">
                    Try Again
                  </button>
                )}
                <button onClick={() => navigate("/")} className="btn-outline px-6 py-2.5 text-sm font-medium">
                  Back to Home
                </button>
              </div>
            </>
          )}

          {/* Cancelled */}
          {phase === "cancelled" && (
            <>
              <XCircle className="h-16 w-16 mx-auto mb-5" style={{ color: "var(--badge-open-text)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Payment Cancelled</h1>
              <p className="text-sm opacity-70 mb-8">
                No payment was taken and nothing has been saved.
                Your registration details are preserved — click Try Again to continue.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleTryAgain} className="btn-primary px-6 py-2.5 text-sm font-semibold">
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