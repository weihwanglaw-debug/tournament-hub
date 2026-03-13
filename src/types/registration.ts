/**
 * registration.ts — Complete registration data schema
 *
 * Hierarchy:
 *   Registration (one form submission, one contact, covers N programs)
 *   └── ParticipantGroup[] (one per program — this is the fixture SeedEntry unit)
 *       ├── Participant[]   (1 = singles, 2 = doubles, N = team)
 *       └── PaymentItem     (fee for this program slot)
 *
 * Key links:
 *   ParticipantGroup.id  === SeedEntry.id  (fixture system uses this)
 *   Registration.id      === receipt grouping
 *
 * Payment:
 *   One Payment record per Registration.
 *   Payment.lineItems[] map 1-to-1 with ParticipantGroups (via paymentItemId).
 *   One receipt number per payment (covers all programs in the submission).
 */

export type RegStatus     = "Pending" | "Confirmed" | "Cancelled" | "Waitlisted";
export type PaymentStatus = "Pending" | "Paid" | "Refunded" | "Partially Refunded";
export type RefundStatus  = "None" | "Full" | "Partial";
export type PaymentMethod = "Credit Card" | "PayNow" | "Cash" | "Bank Transfer" | "Others";

// ── Participant (one person) ───────────────────────────────────────────────────

export interface RegistrationParticipant {
  id:                  string;   // "PART-001"
  participantGroupId:  string;   // FK → ParticipantGroup.id
  fullName:            string;
  dob:                 string;   // "YYYY-MM-DD"
  gender:              string;
  nationality:         string;
  clubSchoolCompany:   string;
  email?:              string;
  contactNumber?:      string;
  tshirtSize?:         string;
  sbaId?:              string;
  guardianName?:       string;
  guardianContact?:    string;
  remark?:             string;
  documentUrl?:        string;
  customFieldValues:   Record<string, string>;
}

// ── ParticipantGroup (one fixture entry — singles/doubles/team) ────────────────

export interface ParticipantGroup {
  id:              string;   // "PG-001" — maps to SeedEntry.id in fixture
  registrationId:  string;   // FK → Registration.id
  eventId:         string;
  programId:       string;
  programName:     string;
  fee:             number;
  groupStatus:     RegStatus;
  seed:            number | null;
  participants:    RegistrationParticipant[];
  // Derived display
  clubDisplay:     string;   // first participant's club (or group club)
  namesDisplay:    string;   // e.g. "Lee Wei Jie / Tan Ah Kow"
}

// ── Payment line item (one per ParticipantGroup) ──────────────────────────────

export interface PaymentLineItem {
  id:               string;   // "PI-001"
  participantGroupId: string;
  participantId?:   string;   // only set when feeStructure = "per_player"; absent = per_entry flat fee
  programName:      string;
  playerName?:      string;   // display label when per_player (e.g. "Lee Wei Jie")
  amount:           number;
  refundedAmount:   number;
  refundStatus:     RefundStatus;
  refundDate?:      string;
  refundReason?:    string;
}

// ── Payment (one per Registration, one receipt) ───────────────────────────────

export interface Payment {
  id:             string;   // "PAY-001"
  registrationId: string;
  receiptNo:      string;   // "RCP-0001" — generated on payment
  method:         PaymentMethod;
  paymentStatus:  PaymentStatus;
  paidDate?:      string;
  remarks?:       string;
  lineItems:      PaymentLineItem[];
}

// ── Registration (one form submission) ───────────────────────────────────────

export interface Registration {
  id:              string;   // "REG-001"
  eventId:         string;
  eventName:       string;
  submittedAt:     string;   // ISO datetime
  regStatus:       RegStatus;
  // Contact (the person who submitted)
  contactName:     string;
  contactEmail:    string;
  contactPhone:    string;
  // Programs enrolled
  groups:          ParticipantGroup[];
  // Payment (single receipt for all programs)
  payment:         Payment;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Flatten a registration into SeedEntry-compatible objects for the fixture wizard */
export function groupsToSeedEntries(groups: ParticipantGroup[]) {
  return groups
    .filter(g => g.groupStatus !== "Cancelled")
    .map(g => ({
      id:           g.id,
      club:         g.clubDisplay,
      participants: g.participants.map(p => p.fullName),
      seed:         g.seed,
      sbaId:        g.participants[0]?.sbaId,
    }));
}

/** Total fee for a registration */
export function totalFee(reg: Registration): number {
  return reg.groups.reduce((s, g) => s + g.fee, 0);
}

/** Total refunded for a registration */
export function totalRefunded(reg: Registration): number {
  return reg.payment.lineItems.reduce((s, li) => s + li.refundedAmount, 0);
}

/** All participant names across all groups in a registration */
export function allParticipantNames(reg: Registration): string[] {
  return reg.groups.flatMap(g => g.participants.map(p => p.fullName));
}