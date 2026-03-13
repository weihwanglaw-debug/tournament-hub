/**
 * AuthContext.tsx — Authentication state for the app.
 *
 * MOCK:  apiLogin / apiLogout delegate to mockUserStore internally.
 * REAL:  swap function bodies in authApi.ts only — this file never changes.
 *
 * login() is now async. Callers (LoginModal) must await it.
 * The signature change is intentional: sync login can't work once the real
 * backend requires a network round-trip.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { AdminUser } from "@/types/config";
import { apiLogin, apiLogout } from "@/lib/api";

interface AuthState {
  isAuthenticated: boolean;
  user:   AdminUser | null;
  login:  (email: string, password: string) => Promise<string | null>;  // null = success, string = error msg
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  user:   null,
  login:  async () => "Not initialised",
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(null);

  // ── Restore session on boot ──────────────────────────────────────────────
  // Reads cached user from localStorage so the UI doesn't flash logged-out.
  // MOCK: re-validates against in-memory mockUserStore (catches deleted users).
  // REAL: replace the inner block with apiGetMe(token) to validate the JWT.
  useEffect(() => {
    const saved = localStorage.getItem("trs_user");
    if (!saved) return;
    try {
      const parsed: AdminUser = JSON.parse(saved);
      // Dynamic import keeps the mock dep tree-shakeable when backend is live.
      import("@/data/mockUsers").then(({ mockUserStore }) => {
        const stillExists = mockUserStore.getAll().find(u => u.id === parsed.id);
        if (stillExists) setUser(stillExists);
        else             localStorage.removeItem("trs_user");
      });
    } catch {
      localStorage.removeItem("trs_user");
    }
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<string | null> => {
    const result = await apiLogin(email, password);
    if (result.error) return result.error.message;
    setUser(result.data.user);
    localStorage.setItem("trs_user", JSON.stringify(result.data.user));
    return null;   // success
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    await apiLogout();   // REAL: invalidates JWT server-side
    setUser(null);
    localStorage.removeItem("trs_user");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};