/**
 * _base.ts — Shared API primitives.
 *
 * Every API module uses these types and helpers so the entire surface
 * is consistent. When you switch to a real backend, only the function
 * bodies change — callers stay the same.
 *
 * ── AUTH STRATEGY ─────────────────────────────────────────────────────────────
 *
 * Two header helpers — pick the right one per endpoint:
 *
 *   publicHeaders()   No Authorization header.
 *                     Use for: public registration, checkout, payment result.
 *                     Matches your HTML payment page — no login required.
 *
 *   adminHeaders()    Includes Authorization: Bearer <token>.
 *                     Use for: all /admin/* endpoints, refunds, status patches.
 *                     Token is stored in localStorage by AuthContext after login.
 *
 * Rule of thumb:
 *   Public-facing pages (EventDetail, PaymentResult) → publicHeaders()
 *   Admin pages (Registrations, Dashboard, UserManagement…) → adminHeaders()
 *
 * ── BASE URL ──────────────────────────────────────────────────────────────────
 *
 * Set VITE_API_BASE_URL in your .env files:
 *   .env.development  →  VITE_API_BASE_URL=https://localhost:7183
 *   .env.production   →  VITE_API_BASE_URL=https://api.yourdomain.com
 *
 * All real fetch() calls prepend API_BASE so you never hardcode the domain.
 */

// ── Base URL ──────────────────────────────────────────────────────────────────

export const API_BASE: string =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? "";

// ── Result envelope ───────────────────────────────────────────────────────────

export interface ApiError {
  code: string;       // machine-readable, e.g. "NOT_FOUND", "VALIDATION"
  message: string;    // human-readable for toast/display
}

export type ApiResult<T> =
  | { data: T;    error: null }
  | { data: null; error: ApiError };

export function ok<T>(data: T): ApiResult<T> {
  return { data, error: null };
}

export function err(code: string, message: string): ApiResult<never> {
  return { data: null, error: { code, message } };
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Token stored by AuthContext after login */
export function getToken(): string {
  return localStorage.getItem("trs_token") ?? "";
}

/**
 * Public endpoints — no Authorization header.
 * Use for: registration submission, checkout initiation, payment result lookup,
 *          event listing, SBA member lookup. None of these require the user to
 *          be logged in; matching your HTML checkout page behaviour exactly.
 */
export function publicHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

/**
 * Admin/protected endpoints — includes Authorization: Bearer <token>.
 * Use for: all admin pages, refunds, registration status patches,
 *          user management, config updates.
 */
export function adminHeaders(): Record<string, string> {
  const token = getToken();
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (token) base["Authorization"] = `Bearer ${token}`;
  return base;
}

// ── Backend error parser ──────────────────────────────────────────────────────

/**
 * Safely extract an error message from a failed fetch() response.
 * Tries JSON first (ASP.NET ProblemDetails), falls back to status text.
 */
export async function parseError(
  res: Response,
  fallback = "An unexpected error occurred.",
): Promise<ApiError> {
  try {
    const body = await res.json();
    const message = body?.message ?? body?.title ?? body?.detail ?? fallback;
    const code    = body?.code ?? `HTTP_${res.status}`;
    return { code, message };
  } catch {
    return { code: `HTTP_${res.status}`, message: res.statusText || fallback };
  }
}

// ── Mock delay ────────────────────────────────────────────────────────────────

const DELAY_MS = Number(import.meta.env?.VITE_MOCK_DELAY_MS ?? 60);
export const delay = () => new Promise(r => setTimeout(r, DELAY_MS));

// ── Pagination helpers ────────────────────────────────────────────────────────

export interface PageParams {
  page: number;     // 1-based
  pageSize: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function paginate<T>(items: T[], { page, pageSize }: PageParams): PagedResult<T> {
  const total      = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage   = Math.min(Math.max(1, page), totalPages);
  const start      = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages };
}
