/**
 * registrationsApi.ts — Registration, Payment & Refund management.
 *
 * Real backend endpoints:
 *   GET    /registrations                               list (filterable, paged)
 *   GET    /registrations/:id                           single registration + payment + items
 *   POST   /registrations                               public: create registration (status=Pending)
 *   PATCH  /registrations/:id/status                   admin: change reg status
 *   PATCH  /registrations/:id/groups/:gid/status       admin: change group status
 *   PATCH  /registrations/:id/groups/:gid/seed         admin: assign/clear seed
 *
 *   POST   /registrations/:id/payment/checkout         public: create gateway checkout session
 *   GET    /registrations/:id/payment                  get payment + items
 *   PATCH  /registrations/:id/payment                  admin: manual payment update
 *   GET    /registrations/:id/payment/refunds          list all refunds for this payment
 *   POST   /registrations/:id/payment/refunds          admin: initiate refund on one item
 *
 *   GET    /registrations/export                       raw data for CSV export
 *   GET    /registrations/stats                        dashboard aggregate counts
 *
 * Mock: reads/writes an in-memory clone of MOCK_REGISTRATIONS.
 * Swap: replace each function body with the commented-out fetch() block.
 *
 * Status code alignment (frontend type → DB value):
 *   PaymentStatus: "Pending"→'P'  "Success"→'S'  "PartiallyRefunded"→'PR'
 *                  "FullyRefunded"→'FR'  "Failed"→'F'  "Cancelled"→'X'
 *   ItemStatus:    "Pending"→'P'  "Success"→'S'  "Refunded"→'R'
 *   RefundStatus:  "Pending"→'P'  "Success"→'S'  "Failed"→'F'
 *
 * Consumers: Registrations.tsx (admin), EventDetail.tsx (public registration form),
 *            Fixtures.tsx (seed assignment), PaymentResult.tsx, Dashboard.tsx, exportCsv.ts
 */

import { ok, err, delay, paginate } from "./_base";
import type { ApiResult, PageParams, PagedResult } from "./_base";
import type {
  Registration, ParticipantGroup, Payment, PaymentItem,
  Refund, CheckoutSession, PaymentStatus,
} from "@/types/registration";
import { MOCK_REGISTRATIONS } from "@/data/mock-registrations";

// ── In-memory store (mock only) ───────────────────────────────────────────────
let _regs: Registration[]         = JSON.parse(JSON.stringify(MOCK_REGISTRATIONS));
let _refunds: Refund[]            = [];   // Separate store — mirrors DB Refunds table
let _refundSeq                    = 0;

// ── Filter params ─────────────────────────────────────────────────────────────

export interface RegistrationFilters {
  eventId?:      string;
  programId?:    string;
  regStatus?:    string;   // "Pending"|"Confirmed"|"Cancelled"|"Waitlisted"
  payStatus?:    string;   // PaymentStatus value
  search?:       string;   // name / email / receipt number
  dateFrom?:     string;   // submittedAt ISO date
  dateTo?:       string;
}

// RegistrationStats is defined in @/types/registration.ts
import type { RegistrationStats } from "@/types/registration";

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /registrations
 * Paged list with optional filters.
 * Used by: Registrations.tsx admin table.
 */
export async function apiGetRegistrations(
  filters?: RegistrationFilters,
  page?: PageParams,
): Promise<ApiResult<PagedResult<Registration>>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  let result = [..._regs];
  if (filters?.eventId)
    result = result.filter(r => r.eventId === filters.eventId);
  if (filters?.programId)
    result = result.filter(r => r.groups.some(g => g.programId === filters.programId));
  if (filters?.regStatus)
    result = result.filter(r => r.regStatus === filters.regStatus);
  if (filters?.payStatus)
    result = result.filter(r => r.payment.paymentStatus === filters.payStatus);
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

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const p = new URLSearchParams();
  // if (filters?.eventId)   p.set("eventId",   filters.eventId);
  // if (filters?.programId) p.set("programId", filters.programId);
  // if (filters?.regStatus) p.set("regStatus", filters.regStatus);
  // if (filters?.payStatus) p.set("payStatus", filters.payStatus);
  // if (filters?.search)    p.set("search",    filters.search);
  // if (page)               { p.set("page", String(page.page)); p.set("pageSize", String(page.pageSize)); }
  // const res = await fetch(`/api/registrations?${p}`);
  // if (!res.ok) return err("FETCH_FAILED", "Failed to load registrations.");
  // return ok(await res.json());
}

/**
 * GET /registrations/:id
 * Single registration with full nested groups, participants, and payment+items.
 * Refunds are fetched separately via apiGetRefunds().
 */
export async function apiGetRegistration(id: string): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === id);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  return ok({ ...reg });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${id}`);
  // if (!res.ok) return err("NOT_FOUND", "Registration not found.");
  // return ok(await res.json());
}

/**
 * POST /registrations
 * Public: creates a new registration with status=Pending and payment=Pending.
 * Does NOT initiate the checkout session — call apiInitiateCheckout() next.
 * Returns the created registration so the caller has the ID for checkout.
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
    payment: {
      ...payload.payment,
      id: payId,
      paymentStatus: "Pending",
      createdAt: new Date().toISOString(),
    },
  };
  _regs = [..._regs, newReg];
  return ok(newReg);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch("/api/registrations", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // });
  // if (!res.ok) return err("CREATE_FAILED", "Failed to submit registration.");
  // return ok(await res.json());
}

/**
 * PATCH /registrations/:id/status
 * Admin: change the overall registration status.
 * e.g. Pending → Confirmed after manual payment verification.
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

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${id}/status`, {
  //   method: "PATCH",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ status }),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to update status.");
  // return ok(await res.json());
}

/**
 * PATCH /registrations/:id/groups/:gid/status
 * Admin: change the status of one ParticipantGroup (e.g. withdraw one doubles pair
 * while keeping the singles entry active within the same registration).
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
    groups: _regs[idx].groups.map(g =>
      g.id === groupId ? { ...g, groupStatus: status } : g
    ),
  };
  return ok({ ..._regs[idx] });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${registrationId}/groups/${groupId}/status`, {
  //   method: "PATCH",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ status }),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to update group status.");
  // return ok(await res.json());
}

/**
 * PATCH /registrations/:id/groups/:gid/seed
 * Admin: assign or clear the seeding number for a ParticipantGroup.
 * This seed value flows directly into SeedEntry.seed in the fixture engine.
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
    groups: _regs[idx].groups.map(g =>
      g.id === groupId ? { ...g, seed } : g
    ),
  };
  return ok({ ..._regs[idx] });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${registrationId}/groups/${groupId}/seed`, {
  //   method: "PATCH",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ seed }),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to update seed.");
  // return ok(await res.json());
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /registrations/:id/payment/checkout
 * Public: creates a gateway checkout session for a Pending registration.
 * Returns a CheckoutSession containing the URL to redirect the user to.
 *
 * Backend behaviour:
 *   1. Creates a Stripe Checkout Session with line items from PaymentItems
 *   2. Stores GatewaySessionID on the Payment record
 *   3. Returns the hosted checkout URL
 *   4. Webhook (checkout.session.completed) will later flip status to Success
 *
 * DB: writes Payments.GatewaySessionID, keeps PaymentStatus='P'
 */
export async function apiInitiateCheckout(
  registrationId: string,
): Promise<ApiResult<CheckoutSession>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  if (reg.payment.paymentStatus !== "Pending")
    return err("INVALID_STATE", "Payment is not in Pending state.");

  const mockSessionId = `cs_mock_${Date.now().toString(36)}`;
  const idx = _regs.findIndex(r => r.id === registrationId);
  _regs[idx] = {
    ..._regs[idx],
    payment: { ..._regs[idx].payment, gatewaySessionId: mockSessionId },
  };

  return ok({
    registrationId,
    paymentId:       reg.payment.id,
    checkoutUrl:     `/payment/result?status=success&reg=${registrationId}`,
    gatewaySessionId: mockSessionId,
    expiresAt:       new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${registrationId}/payment/checkout`, {
  //   method: "POST",
  // });
  // if (!res.ok) return err("CHECKOUT_FAILED", "Failed to create checkout session.");
  // return ok(await res.json());  // returns CheckoutSession
  // // Then: window.location.href = result.data.checkoutUrl;
}

/**
 * GET /registrations/:id/payment
 * Returns the payment record + all payment items for a registration.
 * Used when you need payment details without loading the full registration.
 */
export async function apiGetPayment(
  registrationId: string,
): Promise<ApiResult<Payment>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  return ok({ ...reg.payment });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${registrationId}/payment`);
  // if (!res.ok) return err("NOT_FOUND", "Payment not found.");
  // return ok(await res.json());
}

/**
 * PATCH /registrations/:id/payment
 * Admin: manually record or update payment details.
 * Used for Cash / Bank Transfer payments that don't go through the gateway.
 * Also used to manually confirm a PayNow payment by receipt verification.
 *
 * When status is set to "Success":
 *   - All PaymentItems → itemStatus = "Success"
 *   - receiptNo is generated if not provided
 *   - paidAt is stamped
 *
 * DB: updates Payments table; triggers BackgroundJobs for email + receipt
 */
export async function apiUpdatePayment(
  registrationId: string,
  patch: Partial<Pick<Payment,
    "method" | "gateway" | "paymentStatus" | "receiptNo" | "paidAt"
  >> & { adminNote?: string },
): Promise<ApiResult<Registration>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const idx = _regs.findIndex(r => r.id === registrationId);
  if (idx < 0) return err("NOT_FOUND", "Registration not found.");

  const now = new Date().toISOString();
  let paymentPatch: Partial<Payment> = { ...patch };

  if (patch.paymentStatus === "Success") {
    // Stamp paidAt and flip all items to Success
    paymentPatch.paidAt = now;
    if (!patch.receiptNo) {
      const d = new Date();
      paymentPatch.receiptNo = `TRS-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*99999)).padStart(5,"0")}`;
    }
    const updatedItems: PaymentItem[] = _regs[idx].payment.items.map(item => ({
      ...item, itemStatus: "Success" as const,
    }));
    paymentPatch = { ...paymentPatch, items: updatedItems };
  }

  _regs[idx] = {
    ..._regs[idx],
    payment: { ..._regs[idx].payment, ...paymentPatch },
  };
  return ok({ ..._regs[idx] });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${registrationId}/payment`, {
  //   method: "PATCH",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(patch),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to update payment.");
  // return ok(await res.json());
}

// ─────────────────────────────────────────────────────────────────────────────
// REFUND ENDPOINTS
// Refunds are a first-class entity (DB: Refunds table), NOT embedded in Payment.
// Each refund targets a specific PaymentItem — never the whole Payment.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /registrations/:id/payment/refunds
 * Returns all Refund records for a payment.
 * Fetch this alongside the payment to display full refund history.
 *
 * DB: SELECT * FROM Refunds WHERE PaymentID = @PaymentID
 */
export async function apiGetRefunds(
  registrationId: string,
): Promise<ApiResult<Refund[]>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");
  const paymentId = reg.payment.id;
  return ok(_refunds.filter(r => r.paymentId === paymentId));

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${registrationId}/payment/refunds`);
  // if (!res.ok) return err("FETCH_FAILED", "Failed to load refunds.");
  // return ok(await res.json());
}

/**
 * POST /registrations/:id/payment/refunds
 * Admin: initiates a refund on a specific PaymentItem.
 *
 * Rules enforced here (matching DB constraints):
 *   1. PaymentItem.itemStatus must be "Success" (only paid items can be refunded)
 *   2. No existing "Pending" refund for the same PaymentItem
 *      (DB: UQ_Refunds_OneActivePerItem filtered unique index)
 *   3. refundAmount must be ≤ PaymentItem.amount
 *
 * Backend behaviour after INSERT:
 *   → BackgroundJob: ProcessGatewayRefund (calls Stripe refund API)
 *   → Webhook charge.refunded → flips PaymentItem.itemStatus = Refunded
 *   → Recalculates Payment.paymentStatus (PartiallyRefunded / FullyRefunded)
 *
 * Returns the created Refund record (status will be "Pending" initially).
 */
export async function apiInitiateRefund(
  registrationId: string,
  paymentItemId: string,
  refundAmount: number,
  refundReason: string,
  requestedBy: string,
): Promise<ApiResult<Refund>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const reg = _regs.find(r => r.id === registrationId);
  if (!reg) return err("NOT_FOUND", "Registration not found.");

  const item = reg.payment.items.find(i => i.id === paymentItemId);
  if (!item) return err("NOT_FOUND", "Payment item not found.");

  // Rule 1: item must be Success
  if (item.itemStatus !== "Success")
    return err("INVALID_STATE", "Only confirmed payment items can be refunded.");

  // Rule 2: no existing Pending refund for this item
  const hasPending = _refunds.some(
    r => r.paymentItemId === paymentItemId && r.refundStatus === "Pending"
  );
  if (hasPending)
    return err("REFUND_IN_PROGRESS",
      "A refund for this item is already in progress. Wait for it to complete before initiating another.");

  // Rule 3: amount check
  if (refundAmount <= 0)
    return err("INVALID_AMOUNT", "Refund amount must be greater than zero.");
  if (refundAmount > item.amount)
    return err("OVER_REFUND", `Maximum refundable amount is ${item.amount}.`);

  const newRefund: Refund = {
    id:            `REF-${String(++_refundSeq).padStart(3, "0")}`,
    paymentId:     reg.payment.id,
    paymentItemId,
    gateway:       reg.payment.gateway,
    refundAmount,
    refundReason,
    refundStatus:  "Pending",
    requestedBy,
    createdAt:     new Date().toISOString(),
  };
  _refunds = [..._refunds, newRefund];

  // Mock: immediately simulate gateway success (real: webhook does this async)
  _simulateRefundSuccess(newRefund.id, registrationId, paymentItemId);

  return ok(newRefund);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/registrations/${registrationId}/payment/refunds`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ paymentItemId, refundAmount, refundReason }),
  // });
  // if (!res.ok) {
  //   const body = await res.json().catch(() => ({}));
  //   return err(body.code ?? "REFUND_FAILED", body.message ?? "Failed to initiate refund.");
  // }
  // return ok(await res.json());
}

/**
 * Mock helper: simulates the async webhook confirming a refund.
 * In production this is done by the gateway webhook + background job.
 * Remove entirely when switching to real backend.
 */
function _simulateRefundSuccess(
  refundId: string,
  registrationId: string,
  paymentItemId: string,
) {
  setTimeout(() => {
    // 1. Flip refund → Success
    _refunds = _refunds.map(r =>
      r.id !== refundId ? r : {
        ...r,
        refundStatus:    "Success" as const,
        gatewayRefundId: `re_mock_${Date.now().toString(36)}`,
        processedAt:     new Date().toISOString(),
      }
    );

    // 2. Flip PaymentItem → Refunded
    const idx = _regs.findIndex(r => r.id === registrationId);
    if (idx < 0) return;
    const updatedItems = _regs[idx].payment.items.map(item =>
      item.id !== paymentItemId ? item : { ...item, itemStatus: "Refunded" as const }
    );

    // 3. Recalculate Payment status
    const allRefunded  = updatedItems.every(i => i.itemStatus === "Refunded");
    const anyRefunded  = updatedItems.some(i => i.itemStatus === "Refunded");
    const paymentStatus: PaymentStatus =
      allRefunded ? "FullyRefunded" : anyRefunded ? "PartiallyRefunded" : "Success";

    _regs[idx] = {
      ..._regs[idx],
      payment: { ..._regs[idx].payment, items: updatedItems, paymentStatus },
    };
  }, 500);   // simulate 500ms async delay
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /registrations/export?eventId=&programId=
 * Returns raw registration data for CSV export.
 * exportCsv.ts handles the actual file download client-side.
 *
 * DB: Full join across EventRegistrations → ParticipantGroups → Participants
 */
export async function apiExportRegistrations(
  eventId: string,
  programId?: string,
): Promise<ApiResult<Registration[]>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  let result = _regs.filter(r => r.eventId === eventId);
  if (programId)
    result = result.filter(r => r.groups.some(g => g.programId === programId));
  return ok(result);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const p = new URLSearchParams({ eventId });
  // if (programId) p.set("programId", programId);
  // const res = await fetch(`/api/registrations/export?${p}`);
  // if (!res.ok) return err("EXPORT_FAILED", "Failed to export registrations.");
  // return ok(await res.json());
}

/**
 * GET /registrations/stats?eventId=
 * Returns aggregate counts for the Dashboard.
 * Replaces the mockStats block in config.json.
 *
 * DB: COUNT(*) GROUP BY RegStatus + PaymentStatus queries on EventRegistrations
 */
export async function apiGetRegistrationStats(
  eventId?: string,
): Promise<ApiResult<RegistrationStats>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  let regs = eventId ? _regs.filter(r => r.eventId === eventId) : _regs;
  const stats: RegistrationStats = {
    totalRegistrations: regs.length,
    confirmed:  regs.filter(r => r.regStatus === "Confirmed").length,
    pending:    regs.filter(r => r.regStatus === "Pending").length,
    cancelled:  regs.filter(r => r.regStatus === "Cancelled").length,
    waitlisted: regs.filter(r => r.regStatus === "Waitlisted").length,
    totalRevenue: regs
      .filter(r => r.payment.paymentStatus === "Success")
      .reduce((sum, r) => sum + r.payment.amount, 0),
    pendingPayments: regs
      .filter(r => r.payment.paymentStatus === "Pending").length,
  };
  return ok(stats);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const p = eventId ? `?eventId=${eventId}` : "";
  // const res = await fetch(`/api/registrations/stats${p}`);
  // if (!res.ok) return err("FETCH_FAILED", "Failed to load stats.");
  // return ok(await res.json());
}