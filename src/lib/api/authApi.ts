/**
 * authApi.ts — Authentication & session management.
 *
 * Real backend: POST /auth/login, POST /auth/logout, GET /auth/me,
 *               POST /auth/change-password
 *
 * Mock: delegates to mockUserStore (in-memory, seeded from config.json).
 * Swap: replace function bodies with fetch() calls to your auth endpoints.
 *
 * Consumers: AuthContext.tsx
 */

import { ok, err, delay } from "./_base";
import type { ApiResult }  from "./_base";
import type { AdminUser }  from "@/types/config";
import { mockUserStore }   from "@/data/mockUsers";

// ── Response shapes ───────────────────────────────────────────────────────────

export interface LoginResponse {
  user:  AdminUser;
  token: string;   // JWT (mock returns a dummy string; real backend returns signed JWT)
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Returns the authenticated user + session token.
 */
export async function apiLogin(
  email: string,
  password: string,
): Promise<ApiResult<LoginResponse>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const found = mockUserStore.findByCredentials(email, password);
  if (!found) return err("INVALID_CREDENTIALS", "Invalid email or password.");
  mockUserStore.updateLastLogin(found.id);
  const user = mockUserStore.getAll().find(u => u.id === found.id) ?? found;
  return ok({ user, token: "mock-jwt-token" });

  // ── REAL (swap in when backend ready) ─────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/auth/login`, {
  //   method: "POST",
  //   headers: publicHeaders(),
  //   body: JSON.stringify({ email, password }),
  // });
  // if (!res.ok) return err("INVALID_CREDENTIALS", "Invalid email or password.");
  // return ok(await res.json());
}

/**
 * POST /auth/logout
 * Invalidates the server-side session/token.
 */
export async function apiLogout(): Promise<ApiResult<null>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  return ok(null);   // nothing to invalidate in mock

  // ── REAL ──────────────────────────────────────────────────────────────────
  // await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", headers: adminHeaders() });
  // return ok(null);
}

/**
 * GET /auth/me
 * Re-validates stored token; returns current user or 401.
 * Used on app boot to restore session.
 */
export async function apiGetMe(token: string): Promise<ApiResult<AdminUser>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  // Mock ignores token; validation is done by AuthContext against the store.
  void token;
  return err("NOT_IMPLEMENTED", "Mock: validate session in AuthContext directly.");

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/auth/me`, {
  //   headers: adminHeaders(),
  // });
  // if (!res.ok) return err("UNAUTHORIZED", "Session expired.");
  // return ok(await res.json());
}

/**
 * POST /auth/change-password
 * Requires the current password for self-service change.
 */
export async function apiChangePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ApiResult<null>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const user = mockUserStore.getAll().find(u => u.id === userId);
  if (!user || user.password !== currentPassword)
    return err("INVALID_CREDENTIALS", "Current password is incorrect.");
  mockUserStore.update(userId, { password: newPassword, mustChangePassword: false });
  return ok(null);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/auth/change-password`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   headers: adminHeaders(),
  //   body: JSON.stringify({ userId, currentPassword, newPassword }),
  // });
  // if (!res.ok) return err("INVALID_CREDENTIALS", "Current password is incorrect.");
  // return ok(null);
}