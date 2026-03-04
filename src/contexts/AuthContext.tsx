import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { AdminUser } from "@/types/config";
import { mockUserStore } from "@/data/mockUsers";

interface AuthState {
  isAuthenticated: boolean;
  user: AdminUser | null;
  login: (email: string, password: string) => string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  user: null,
  login: () => "Not initialised",
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("trs_user");
    if (saved) {
      try {
        const parsed: AdminUser = JSON.parse(saved);
        // Re-validate against live store in case user was deleted
        const stillExists = mockUserStore.getAll().find(u => u.id === parsed.id);
        if (stillExists) setUser(stillExists);
        else localStorage.removeItem("trs_user");
      } catch {
        localStorage.removeItem("trs_user");
      }
    }
  }, []);

  const login = (email: string, password: string): string | null => {
    const found = mockUserStore.findByCredentials(email, password);
    if (!found) return "Invalid email or password";
    mockUserStore.updateLastLogin(found.id);
    const updated = mockUserStore.getAll().find(u => u.id === found.id) ?? found;
    setUser(updated);
    localStorage.setItem("trs_user", JSON.stringify(updated));
    return null;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("trs_user");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
