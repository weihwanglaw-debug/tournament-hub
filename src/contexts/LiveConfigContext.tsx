/**
 * LiveConfigContext — wraps config.json values that can be edited at runtime
 * via MasterConfig. Components that read these values use this context instead
 * of importing config.json directly.
 *
 * In production, replace initialState with a GET /api/config fetch.
 */
import React, { createContext, useContext, useState, ReactNode } from "react";
import rawConfig from "@/data/config.json";

export interface LiveConfig {
  appName:       string;
  logoUrl:       string;
  heroTitle:     string;
  heroSubtitle:  string;
  currency:      string;
  contactEmail:  string;
  copyrightText: string;
  consentText:   string;
}

interface LiveConfigState {
  cfg: LiveConfig;
  update: (key: keyof LiveConfig, value: string) => void;
}

const defaults: LiveConfig = {
  appName:       rawConfig.branding.appName,
  logoUrl:       rawConfig.branding.logoUrl,
  heroTitle:     rawConfig.hero.title,
  heroSubtitle:  rawConfig.hero.subtitle,
  currency:      rawConfig.payment.currency,
  contactEmail:  rawConfig.footer.contactEmail,
  copyrightText: rawConfig.footer.copyrightText,
  consentText:   rawConfig.consentText,
};

const LiveConfigContext = createContext<LiveConfigState>({
  cfg: defaults,
  update: () => {},
});

export const useLiveConfig = () => useContext(LiveConfigContext);

export const LiveConfigProvider = ({ children }: { children: ReactNode }) => {
  const [cfg, setCfg] = useState<LiveConfig>(defaults);

  const update = (key: keyof LiveConfig, value: string) =>
    setCfg(prev => ({ ...prev, [key]: value }));

  return (
    <LiveConfigContext.Provider value={{ cfg, update }}>
      {children}
    </LiveConfigContext.Provider>
  );
};
