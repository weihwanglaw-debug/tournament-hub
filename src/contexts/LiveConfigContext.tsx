/**
 * LiveConfigContext — runtime-editable system configuration.
 *
 * Reads initial values from apiGetConfig() (which in mock mode reads config.json,
 * and in real mode calls GET /api/config). Components that need branding, hero
 * copy, or payment currency use useLiveConfig() — never import config.json directly.
 *
 * MasterConfig.tsx writes changes via apiUpdateConfig(), which updates both the
 * in-memory store here and (in real mode) persists to the DB.
 *
 * MOCK → REAL: swap function bodies in configApi.ts only. This file never changes.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiGetConfig, apiUpdateConfig } from "@/lib/api";

export interface LiveConfig {
  appName:       string;
  logoUrl:       string;
  heroTitle:     string;
  heroSubtitle:  string;
  heroImageUrl:  string;
  currency:      string;
  contactEmail:  string;
  copyrightText: string;
  consentText:   string;
}

interface LiveConfigState {
  cfg:     LiveConfig;
  loading: boolean;
  update:  (key: keyof LiveConfig, value: string) => Promise<void>;
}

// Fallback defaults used only during the initial load flash
const EMPTY: LiveConfig = {
  appName: "", logoUrl: "", heroTitle: "", heroSubtitle: "",
  heroImageUrl: "", currency: "SGD", contactEmail: "",
  copyrightText: "", consentText: "",
};

const LiveConfigContext = createContext<LiveConfigState>({
  cfg:     EMPTY,
  loading: true,
  update:  async () => {},
});

export const useLiveConfig = () => useContext(LiveConfigContext);

export const LiveConfigProvider = ({ children }: { children: ReactNode }) => {
  const [cfg,     setCfg]     = useState<LiveConfig>(EMPTY);
  const [loading, setLoading] = useState(true);

  // ── Load config on mount ─────────────────────────────────────────────────
  // MOCK: reads config.json via configApi._config in-memory store.
  // REAL: fetches GET /api/config — no change needed here.
  useEffect(() => {
    apiGetConfig().then(result => {
      if (result.data) setCfg(result.data);
      setLoading(false);
    });
  }, []);

  // ── Update one field ─────────────────────────────────────────────────────
  // Optimistic update: apply locally first, then persist via API.
  const update = async (key: keyof LiveConfig, value: string): Promise<void> => {
    setCfg(prev => ({ ...prev, [key]: value }));   // optimistic
    const result = await apiUpdateConfig({ [key]: value });
    if (result.data) setCfg(result.data);           // reconcile with server value
  };

  return (
    <LiveConfigContext.Provider value={{ cfg, loading, update }}>
      {children}
    </LiveConfigContext.Provider>
  );
};