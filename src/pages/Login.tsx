import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Trophy, Eye, EyeOff } from "lucide-react";
import Header from "@/components/layout/Header";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) {
    navigate("/admin", { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    const err = login(email, password);
    if (err) {
      setError(err);
    } else {
      navigate("/admin");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-6 pt-16" style={{ backgroundColor: "var(--color-page-bg)" }}>
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            className="rounded-2xl p-8 shadow-lg"
            style={{ backgroundColor: "var(--color-row-hover)", border: "1px solid var(--color-table-border)" }}
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <Trophy className="h-6 w-6" style={{ color: "var(--color-primary)" }} />
              <h1 className="font-heading font-bold text-xl">Admin Login</h1>
            </div>

            {error && (
              <div className="p-3 rounded-lg mb-4 text-sm" style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-70">Email</label>
                <input
                  type="email"
                  className="field-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@trs.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-70">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className="field-input pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold">
                Sign In
              </button>
            </form>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
