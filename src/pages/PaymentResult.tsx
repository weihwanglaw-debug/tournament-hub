import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { useMemo } from "react";

export default function PaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get("status");
  const isSuccess = status === "success";
  const receiptNumber = useMemo(() => `TRS-${Date.now().toString(36).toUpperCase()}`, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16 flex items-center justify-center px-8" style={{ backgroundColor: "var(--color-page-bg)" }}>
        <motion.div
          className="max-w-md w-full text-center py-20"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {isSuccess ? (
            <>
              <CheckCircle className="h-16 w-16 mx-auto mb-5" style={{ color: "var(--color-primary)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Registration Confirmed!</h1>
              <p className="text-sm opacity-70 mb-2">
                Receipt Number: <span className="font-mono font-semibold">TRS-{receiptNumber}</span>
              </p>
              <p className="text-sm opacity-60 mb-8">
                A confirmation email has been sent. You may download your receipt below.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button className="btn-primary px-6 py-2.5 text-sm font-semibold">
                  Download Receipt
                </button>
                <button onClick={() => navigate("/")} className="btn-outline px-6 py-2.5 text-sm font-medium">
                  Back to Home
                </button>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 mx-auto mb-5" style={{ color: "var(--badge-open-text)" }} />
              <h1 className="font-heading font-bold text-2xl mb-3">Payment Unsuccessful</h1>
              <p className="text-sm opacity-70 mb-8">
                Something went wrong with your payment. Please try again.
              </p>
              <button onClick={() => navigate(-1)} className="btn-primary px-6 py-2.5 text-sm font-semibold">
                Try Again
              </button>
            </>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
