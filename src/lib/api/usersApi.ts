/**
 * usersApi.ts — Admin user management (CRUD).
 *
 * Real backend: GET/POST /admin/users, PUT/DELETE /admin/users/:id,
 *               POST /admin/users/:id/reset-password
 *
 * Mock: delegates to mockUserStore (same in-memory store as AuthContext).
 * Swap: replace function bodies with fetch() calls.
 *
 * Consumers: Usermanagement.tsx, AuthContext.tsx (read only)
 */

import { ok, err, delay } from "./_base";
import type { ApiResult }  from "./_base";
import type { AdminUser }  from "@/types/config";
import { mockUserStore }   from "@/data/mockUsers";

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /admin/users
 * Returns all admin users. Passwords are stripped server-side in real API.
 */
export async function apiGetUsers(): Promise<ApiResult<AdminUser[]>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  return ok(mockUserStore.getAll());

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch("/api/admin/users");
  // if (!res.ok) return err("FETCH_FAILED", "Failed to load users.");
  // return ok(await res.json());
}

/**
 * POST /admin/users
 * Creates a new admin user. Password is hashed server-side.
 */
export async function apiCreateUser(
  payload: Omit<AdminUser, "id" | "lastLogin">,
): Promise<ApiResult<AdminUser>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const emailTaken = mockUserStore.getAll().some(u => u.email === payload.email);
  if (emailTaken) return err("EMAIL_TAKEN", "Email address is already in use.");
  const newUser: AdminUser = { ...payload, id: `usr-${Date.now().toString(36)}` };
  mockUserStore.add(newUser);
  return ok(newUser);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch("/api/admin/users", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // });
  // if (!res.ok) return err("CREATE_FAILED", "Failed to create user.");
  // return ok(await res.json());
}

/**
 * PUT /admin/users/:id
 * Updates name, email, and/or role. Does NOT update password (use resetPassword).
 */
export async function apiUpdateUser(
  id: string,
  patch: Partial<Pick<AdminUser, "name" | "email" | "role">>,
): Promise<ApiResult<AdminUser>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const user = mockUserStore.getAll().find(u => u.id === id);
  if (!user) return err("NOT_FOUND", "User not found.");
  if (patch.email) {
    const emailTaken = mockUserStore.getAll().some(u => u.email === patch.email && u.id !== id);
    if (emailTaken) return err("EMAIL_TAKEN", "Email address is already in use.");
  }
  mockUserStore.update(id, patch);
  const updated = mockUserStore.getAll().find(u => u.id === id)!;
  return ok(updated);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/admin/users/${id}`, {
  //   method: "PUT",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(patch),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to update user.");
  // return ok(await res.json());
}

/**
 * DELETE /admin/users/:id
 * Permanently removes an admin user. Cannot delete your own account.
 */
export async function apiDeleteUser(
  id: string,
  currentUserId: string,
): Promise<ApiResult<null>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  if (id === currentUserId) return err("CANNOT_DELETE_SELF", "You cannot delete your own account.");
  const user = mockUserStore.getAll().find(u => u.id === id);
  if (!user) return err("NOT_FOUND", "User not found.");
  mockUserStore.remove(id);
  return ok(null);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
  // if (!res.ok) return err("DELETE_FAILED", "Failed to delete user.");
  // return ok(null);
}

/**
 * POST /admin/users/:id/reset-password
 * Admin-initiated reset; does not require the old password.
 */
export async function apiResetUserPassword(
  id: string,
  newPassword: string,
): Promise<ApiResult<null>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const user = mockUserStore.getAll().find(u => u.id === id);
  if (!user) return err("NOT_FOUND", "User not found.");
  mockUserStore.update(id, { password: newPassword, mustChangePassword: true });
  return ok(null);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/admin/users/${id}/reset-password`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ newPassword }),
  // });
  // if (!res.ok) return err("RESET_FAILED", "Failed to reset password.");
  // return ok(null);
}