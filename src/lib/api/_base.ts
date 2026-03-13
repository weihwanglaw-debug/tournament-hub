/**
 * _base.ts — Shared API primitives.
 *
 * Every API module uses these types and helpers so the entire surface
 * is consistent. When you switch to a real backend, only the function
 * bodies change — callers stay the same.
 *
 * Mock delay: simulates network latency during development.
 * Set VITE_MOCK_DELAY_MS=0 in .env to disable.
 */

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