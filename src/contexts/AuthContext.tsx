import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import config from "@/data/config.json";
import type { AdminUser } from "@/types/config";

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
      try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem("trs_user"); }
    }
  }, []);

  const login = (email: string, password: string): string | null => {
    const found = config.admin.users.find(
      (u) => u.email === email && u.password === password
    );
    if (!found) return "Invalid email or password";
    setUser(found);
    localStorage.setItem("trs_user", JSON.stringify(found));
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
