/**
 * registrationsApi.ts — Registration, Payment & Refund management.
 *
 * ── AUTH SPLIT ────────────────────────────────────────────────────────────────
 *
 *   PUBLIC  (no login required — matches HTML checkout page):
 *     apiCreateRegistration()    POST /api/registrations
 *     apiInitiateCheckout()      POST /api/Payment/create-checkout-session
 *     apiGetRegistration()       GET  /api/registrations/:id   (receipt lookup)
 *
 *   ADMIN   (requires Bearer token):
 *     apiGetRegistrations()      GET  /api/registrations        (admin list)
 *     apiUpdateRegistrationStatus()
 *     apiUpdateGroupStatus()
 *     apiUpdateGroupSeed()
 *     apiGetPayment()
 *     apiUpdatePayment()
 *     apiGetRefunds()
 *     apiInitiateRefund()
 *     apiExportRegistrations()
 *     apiGetRegistrationStats()
 *
 * ── REAL BACKEND ──────────────────────────────────────────────────────────────
 * To go live: delete the MOCK block in each function and uncomment the REAL block.
 * No changes needed in EventDetail.tsx, Registrations.tsx, etc.
 *
 * Status code alignment (frontend type → DB value):
 *   PaymentStatus: "Pending"→'P'  "Success"→'S'  "PartiallyRefunded"→'PR'
 *                  "FullyRefunded"→'FR'  "Failed"→'F'  "Cancelled"→'X'
 *   ItemStatus:    "Pending"→'P'  "Success"→'S'  "Refunded"→'R'
 *   RefundStatus:  "Pending"→'P'  "Success"→'S'  "Failed"→'F'
 */

import { ok, err, delay, paginate, API_BASE, publicHeaders, adminHeaders, parseError } from "./_base";
import type { ApiResult, PageParams, PagedResult } from "./_base";
import type {
  Registration, ParticipantGroup, Payment, PaymentItem,
  Refund, CheckoutSession, PaymentStatus, RegistrationStats,
} from "@/types/registration";
import { MOCK_REGISTRATIONS } from "@/data/mock-registrations";

// ── In-memory store (mock only — delete when switching to real backend) ────────
let _regs: Registration[]  = JSON.parse(JSON.stringify(MOCK_REGISTRATIONS));
let _refunds: Refund[]     = [];
let _refundSeq             = 0;

// ── Filter params ─────────────────────────────────────────────────────────────

export interface RegistrationFilters {
  eventId?:   string;
  programId?: string;
  regStatus?: string;
  payStatus?: string;
  search?:    string;
  dateFrom?:  string;
  dateTo?:    string;
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS — no login required
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/registrations
 * Public: creates a new registration (status=Pending, payment=Pending).
 * Called by EventDetail.tsx when the user submits their cart.
 * Does NOT initiate checkout — call apiInitiateCheckout() next.
 */
export async function apiCreateRegistration(
  payload: Omit<Registration, "id" | "submittedAt">,
): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const id    = `REG-${String(_regs.length + 1).padStart(3, "0")}`;
  const payId = `PAY-${String(_regs.length + 1).padStart(3, "0")}`;
  const newReg: Registration = {
    ...payload,
    id,
    submittedAt: new Date().toISOString(),
    payment: { ...payload.payment, id: payId, paymentStatus: "Pending", createdAt: new Date().toISOString() },
  };
  _regs = [..._regs, newReg];
  return ok(newReg);

  // ── REAL (public — no auth header) ────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations`, {
  //   method: "POST",
  //   headers: publicHeaders(),
  //   body: JSON.stringify(payload),
  // });
  // if (!res.ok) return err("CREATE_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * POST /api/Payment/create-checkout-session
 * Public: creates a Stripe checkout session for a Pending registration.
 * Returns CheckoutSession.checkoutUrl — redirect the user there immediately.
 *
 * paymentMethod: "card" | "paynow"
 *   "card"   → Stripe hosted checkout (credit card)
 *   "paynow" → Stripe PayNow flow (or your own PayNow endpoint)
 *
 * Security: amount is NEVER sent from the frontend.
 *   The backend fetches the amount from Payments.Amount in the DB.
 *   This matches your HTML checkout page's design exactly.
 */
export async function apiInitiateCheckout(
  registrationId: string,
  paymentMethod:  "card" | "paynow" = "card",
): Promise<ApiResult<CheckoutSession>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  if (reg.payment.paymentStatus !== "Pending")
    return err("INVALID_STATE", "Payment is not in Pending state.");
  const mockSessionId = `cs_mock_${Date.now().toString(36)}`;
  const idx = _regs.findIndex(r => r.id === registrationId);
  _regs[idx] = { ..._regs[idx], payment: { ..._regs[idx].payment, gatewaySessionId: mockSessionId } };
  return ok({
    registrationId,
    paymentId:        reg.payment.id,
    checkoutUrl:      `/payment/result?status=success&reg=${registrationId}`,
    gatewaySessionId: mockSessionId,
    expiresAt:        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  // ── REAL (public — no auth header) ────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/Payment/create-checkout-session`, {
  //   method: "POST",
  //   headers: publicHeaders(),
  //   body: JSON.stringify({
  //     registrationId: Number(registrationId),  // backend uses INT
  //     paymentMethod,                           // "card" | "paynow"
  //     successUrl: `${window.location.origin}/payment/result?reg=${registrationId}`,
  //     cancelUrl:  `${window.location.origin}/payment/result?status=cancel&reg=${registrationId}`,
  //     // Amount intentionally omitted — backend reads from DB (security requirement)
  //   }),
  // });
  // if (!res.ok) return err("CHECKOUT_FAILED", (await parseError(res)).message);
  // const data = await res.json();
  // return ok({
  //   registrationId,
  //   paymentId:        String(data.paymentId ?? ""),
  //   checkoutUrl:      data.checkoutUrl ?? data.url,
  //   gatewaySessionId: data.gatewaySessionId ?? data.sessionId ?? "",
  //   expiresAt:        data.expiresAt ?? new Date(Date.now() + 86400000).toISOString(),
  // });
}

/**
 * GET /api/registrations/:id
 * Public: used by PaymentResult.tsx to fetch the receipt after Stripe redirects back.
 * No auth needed — the registrationId in the URL is the only required identifier.
 */
export async function apiGetRegistration(id: string): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === id);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  return ok({ ...reg });

  // ── REAL (public — no auth header) ────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${id}`, {
  //   headers: publicHeaders(),
  // });
  // if (!res.ok) return err("NOT_FOUND", (await parseError(res)).message);
  // return ok(await res.json());
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS — require Bearer token
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/registrations
 * Admin: paged list with filters. Used by Registrations.tsx admin table.
 */
export async function apiGetRegistrations(
  filters?: RegistrationFilters,
  page?: PageParams,
): Promise<ApiResult<PagedResult<Registration>>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  let result = [..._regs];
  if (filters?.eventId)   result = result.filter(r => r.eventId === filters.eventId);
  if (filters?.programId) result = result.filter(r => r.groups.some(g => g.programId === filters.programId));
  if (filters?.regStatus) result = result.filter(r => r.regStatus === filters.regStatus);
  if (filters?.payStatus) result = result.filter(r => r.payment.paymentStatus === filters.payStatus);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(r =>
      r.contactName.toLowerCase().includes(q)  ||
      r.contactEmail.toLowerCase().includes(q) ||
      (r.payment.receiptNo ?? "").toLowerCase().includes(q) ||
      r.groups.some(g => g.namesDisplay.toLowerCase().includes(q))
    );
  }
  return ok(paginate(result, page ?? { page: 1, pageSize: 50 }));

  // ── REAL (admin — Bearer token required) ──────────────────────────────────
  // const p = new URLSearchParams();
  // if (filters?.eventId)   p.set("eventId",   filters.eventId);
  // if (filters?.programId) p.set("programId", filters.programId);
  // if (filters?.regStatus) p.set("regStatus", filters.regStatus);
  // if (filters?.payStatus) p.set("payStatus", filters.payStatus);
  // if (filters?.search)    p.set("search",    filters.search);
  // if (page)               { p.set("page", String(page.page)); p.set("pageSize", String(page.pageSize)); }
  // const res = await fetch(`${API_BASE}/api/registrations?${p}`, { headers: adminHeaders() });
  // if (!res.ok) return err("FETCH_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * PATCH /api/registrations/:id/status
 * Admin: change the overall registration status.
 */
export async function apiUpdateRegistrationStatus(
  id: string,
  status: Registration["regStatus"],
): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const idx = _regs.findIndex(r => r.id === id);
  if (idx < 0) return err("NOT_FOUND", "Registration not found.");
  _regs[idx] = { ..._regs[idx], regStatus: status };
  return ok({ ..._regs[idx] });

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${id}/status`, {
  //   method: "PATCH",
  //   headers: adminHeaders(),
  //   body: JSON.stringify({ status }),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * PATCH /api/registrations/:id/groups/:gid/status
 * Admin: change the status of one ParticipantGroup.
 */
export async function apiUpdateGroupStatus(
  registrationId: string,
  groupId: string,
  status: ParticipantGroup["groupStatus"],
): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const idx = _regs.findIndex(r => r.id === registrationId);
  if (idx < 0) return err("NOT_FOUND", "Registration not found.");
  _regs[idx] = {
    ..._regs[idx],
    groups: _regs[idx].groups.map(g => g.id === groupId ? { ...g, groupStatus: status } : g),
  };
  return ok({ ..._regs[idx] });

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${registrationId}/groups/${groupId}/status`, {
  //   method: "PATCH",
  //   headers: adminHeaders(),
  //   body: JSON.stringify({ status }),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * PATCH /api/registrations/:id/groups/:gid/seed
 * Admin: assign or clear the seed number for a ParticipantGroup.
 */
export async function apiUpdateGroupSeed(
  registrationId: string,
  groupId: string,
  seed: number | null,
): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const idx = _regs.findIndex(r => r.id === registrationId);
  if (idx < 0) return err("NOT_FOUND", "Registration not found.");
  _regs[idx] = {
    ..._regs[idx],
    groups: _regs[idx].groups.map(g => g.id === groupId ? { ...g, seed } : g),
  };
  return ok({ ..._regs[idx] });

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${registrationId}/groups/${groupId}/seed`, {
  //   method: "PATCH",
  //   headers: adminHeaders(),
  //   body: JSON.stringify({ seed }),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * GET /api/registrations/:id/payment
 * Admin: returns the payment record + items without the full registration.
 */
export async function apiGetPayment(registrationId: string): Promise<ApiResult<Payment>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  return ok({ ...reg.payment });

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${registrationId}/payment`, {
  //   headers: adminHeaders(),
  // });
  // if (!res.ok) return err("NOT_FOUND", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * PATCH /api/registrations/:id/payment
 * Admin: manually record or update payment (Cash, Bank Transfer, PayNow receipt).
 * When status = "Success": backend stamps paidAt, generates receiptNo, flips items → S,
 * queues SendConfirmationEmail + GenerateReceipt background jobs.
 */
export async function apiUpdatePayment(
  registrationId: string,
  patch: Partial<Pick<Payment, "method" | "gateway" | "paymentStatus" | "receiptNo" | "paidAt">>
    & { adminNote?: string },
): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const idx = _regs.findIndex(r => r.id === registrationId);
  if (idx < 0) return err("NOT_FOUND", "Registration not found.");
  const now = new Date().toISOString();
  let paymentPatch: Partial<Payment> = { ...patch };
  if (patch.paymentStatus === "Success") {
    paymentPatch.paidAt = now;
    if (!patch.receiptNo) {
      const d = new Date();
      paymentPatch.receiptNo = `TRS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*99999)).padStart(5,"0")}`;
    }
    paymentPatch = {
      ...paymentPatch,
      items: _regs[idx].payment.items.map(item => ({ ...item, itemStatus: "Success" as const })),
    };
  }
  _regs[idx] = { ..._regs[idx], payment: { ..._regs[idx].payment, ...paymentPatch } };
  return ok({ ..._regs[idx] });

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${registrationId}/payment`, {
  //   method: "PATCH",
  //   headers: adminHeaders(),
  //   body: JSON.stringify(patch),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * GET /api/registrations/:id/payment/refunds
 * Admin: returns all Refund records for a payment.
 */
export async function apiGetRefunds(registrationId: string): Promise<ApiResult<Refund[]>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  return ok(_refunds.filter(r => r.paymentId === reg.payment.id));

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${registrationId}/payment/refunds`, {
  //   headers: adminHeaders(),
  // });
  // if (!res.ok) return err("FETCH_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * POST /api/registrations/:id/payment/refunds
 * Admin: initiates a refund on a specific PaymentItem.
 * Backend queues ProcessGatewayRefund job → Stripe → webhook flips status.
 *
 * DB constraints enforced:
 *   1. PaymentItem.ItemStatus must be 'S' (only paid items refundable)
 *   2. No existing Pending refund for the same PaymentItemID
 *      (UQ_Refunds_OneActivePerItem filtered unique index)
 *   3. refundAmount ≤ PaymentItem.Amount
 */
export async function apiInitiateRefund(
  registrationId: string,
  paymentItemId:  string,
  refundAmount:   number,
  refundReason:   string,
  requestedBy:    string,
): Promise<ApiResult<Refund>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  const item = reg.payment.items.find(i => i.id === paymentItemId);
  if (!item) return err("NOT_FOUND", "Payment item not found.");
  if (item.itemStatus !== "Success")
    return err("INVALID_STATE", "Only confirmed payment items can be refunded.");
  const hasPending = _refunds.some(r => r.paymentItemId === paymentItemId && r.refundStatus === "Pending");
  if (hasPending)
    return err("REFUND_IN_PROGRESS", "A refund for this item is already in progress.");
  if (refundAmount <= 0)    return err("INVALID_AMOUNT", "Refund amount must be greater than zero.");
  if (refundAmount > item.amount) return err("OVER_REFUND", `Maximum refundable amount is ${item.amount}.`);
  const newRefund: Refund = {
    id: `REF-${String(++_refundSeq).padStart(3, "0")}`,
    paymentId: reg.payment.id, paymentItemId,
    gateway: reg.payment.gateway, refundAmount, refundReason,
    refundStatus: "Pending", requestedBy,
    createdAt: new Date().toISOString(),
  };
  _refunds = [..._refunds, newRefund];
  _simulateRefundSuccess(newRefund.id, registrationId, paymentItemId);
  return ok(newRefund);

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const res = await fetch(`${API_BASE}/api/registrations/${registrationId}/payment/refunds`, {
  //   method: "POST",
  //   headers: adminHeaders(),
  //   body: JSON.stringify({ paymentItemId, refundAmount, refundReason }),
  // });
  // if (!res.ok) {
  //   const e = await parseError(res);
  //   return err(e.code, e.message);
  // }
  // return ok(await res.json());
}

/** Mock only: simulates async webhook confirming refund. Remove when switching to real backend. */
function _simulateRefundSuccess(refundId: string, registrationId: string, paymentItemId: string) {
  setTimeout(() => {
    _refunds = _refunds.map(r => r.id !== refundId ? r : {
      ...r, refundStatus: "Success" as const,
      gatewayRefundId: `re_mock_${Date.now().toString(36)}`,
      processedAt: new Date().toISOString(),
    });
    const idx = _regs.findIndex(r => r.id === registrationId);
    if (idx < 0) return;
    const updatedItems = _regs[idx].payment.items.map(item =>
      item.id !== paymentItemId ? item : { ...item, itemStatus: "Refunded" as const }
    );
    const allRefunded = updatedItems.every(i => i.itemStatus === "Refunded");
    const anyRefunded = updatedItems.some(i => i.itemStatus === "Refunded");
    const paymentStatus: PaymentStatus = allRefunded ? "FullyRefunded" : anyRefunded ? "PartiallyRefunded" : "Success";
    _regs[idx] = { ..._regs[idx], payment: { ..._regs[idx].payment, items: updatedItems, paymentStatus } };
  }, 500);
}

/**
 * GET /api/registrations/export
 * Admin: raw data for CSV export.
 */
export async function apiExportRegistrations(
  eventId?: string,
  programId?: string,
): Promise<ApiResult<Registration[]>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  let result = [..._regs];
  if (eventId && eventId !== "all") result = result.filter(r => r.eventId === eventId);
  if (programId) result = result.filter(r => r.groups.some(g => g.programId === programId));
  return ok(result);

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const p = new URLSearchParams();
  // if (eventId && eventId !== "all") p.set("eventId", eventId);
  // if (programId) p.set("programId", programId);
  // const res = await fetch(`${API_BASE}/api/registrations/export?${p}`, { headers: adminHeaders() });
  // if (!res.ok) return err("EXPORT_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}

/**
 * GET /api/registrations/stats
 * Admin: aggregate counts for the Dashboard.
 */
export async function apiGetRegistrationStats(
  eventId?: string,
): Promise<ApiResult<RegistrationStats>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const regs = eventId ? _regs.filter(r => r.eventId === eventId) : _regs;
  return ok({
    totalRegistrations: regs.length,
    confirmed:    regs.filter(r => r.regStatus === "Confirmed").length,
    pending:      regs.filter(r => r.regStatus === "Pending").length,
    cancelled:    regs.filter(r => r.regStatus === "Cancelled").length,
    waitlisted:   regs.filter(r => r.regStatus === "Waitlisted").length,
    totalRevenue: regs.filter(r => r.payment.paymentStatus === "Success").reduce((s, r) => s + r.payment.amount, 0),
    pendingPayments: regs.filter(r => r.payment.paymentStatus === "Pending").length,
  });

  // ── REAL (admin) ──────────────────────────────────────────────────────────
  // const p = eventId ? `?eventId=${eventId}` : "";
  // const res = await fetch(`${API_BASE}/api/registrations/stats${p}`, { headers: adminHeaders() });
  // if (!res.ok) return err("FETCH_FAILED", (await parseError(res)).message);
  // return ok(await res.json());
}
