/**
 * configApi.ts — System-wide master configuration.
 *
 * Real backend: GET /config, PUT /config
 *
 * The config stores branding, hero copy, footer, payment currency, and
 * the global consent statement. It is shared across all events.
 *
 * Mock: reads from config.json; writes go to LiveConfigContext (in-memory).
 *       In production, PUT /api/config persists to the database config table.
 *
 * Consumers: LiveConfigContext.tsx, Masterconfig.tsx
 */

import { ok, delay }     from "./_base";
import type { ApiResult } from "./_base";
import type { LiveConfig } from "@/contexts/LiveConfigContext";
import rawConfig           from "@/data/config.json";

// ── In-memory store (mock only) ───────────────────────────────────────────────
// This mirrors exactly what LiveConfigContext holds in useState().
// The real backend replaces this with a DB row.

let _config: LiveConfig = {
  appName:       rawConfig.branding.appName,
  logoUrl:       rawConfig.branding.logoUrl,
  heroTitle:     rawConfig.hero.title,
  heroSubtitle:  rawConfig.hero.subtitle,
  heroImageUrl:  "",
  currency:      rawConfig.payment.currency,
  contactEmail:  rawConfig.footer.contactEmail,
  copyrightText: rawConfig.footer.copyrightText,
  consentText:   rawConfig.consentText,
};

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /config
 * Returns the current system configuration.
 */
export async function apiGetConfig(): Promise<ApiResult<LiveConfig>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  return ok({ ..._config });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch("/api/config");
  // if (!res.ok) return err("FETCH_FAILED", "Failed to load configuration.");
  // return ok(await res.json());
}

/**
 * PUT /config
 * Saves one or more config fields. Partial updates are supported.
 * Returns the complete updated config.
 */
export async function apiUpdateConfig(
  patch: Partial<LiveConfig>,
): Promise<ApiResult<LiveConfig>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  _config = { ..._config, ...patch };
  return ok({ ..._config });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch("/api/config", {
  //   method: "PUT",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(patch),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to save configuration.");
  // return ok(await res.json());
}