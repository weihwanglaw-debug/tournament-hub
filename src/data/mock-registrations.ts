/**
 * mock-registrations.ts — Realistic mock data matching the new schema.
 *
 * Event evt-1: Singapore Open Badminton Championship 2026
 *   prog-1: Men's Singles (singles)
 *   prog-3: Men's Doubles (doubles)
 *   prog-5: Mixed Doubles (doubles)
 *
 * Scenario:
 *   REG-001: Lee Wei Jie registers for Men's Singles only — Pending
 *   REG-002: Ravi Kumar + Ahmad Farid for Men's Doubles — Paid (receipt RCP-0001)
 *   REG-003: Lee Wei Jie + Tan Mei Ling for Mixed Doubles — Paid (receipt RCP-0002)
 *   REG-004: Same registration covers both Men's Singles (Tan Ah Kow) 
 *            AND Men's Doubles (Tan Ah Kow + Michael Ng) — Paid (one receipt RCP-0003)
 *   REG-005: Rachel Tan for Women's Singles (prog-2) — Refunded
 */

import type { Registration } from "@/types/registration";
// Note: Refunds are stored separately in registrationsApi._refunds (mock)
// and in DB: Refunds table. See apiGetRefunds() and apiInitiateRefund().

let _seq = 0;
const uid = (prefix: string) => `${prefix}-${String(++_seq).padStart(3, "0")}`;

export const MOCK_REGISTRATIONS: Registration[] = [

  // ── REG-001: Single program, single person, pending payment ──────────────
  {
    id: "REG-001",
    eventId: "evt-1",
    eventName: "Singapore Open Badminton Championship 2026",
    submittedAt: "2026-01-10T09:15:00",
    regStatus: "Pending",
    contactName: "Lee Wei Jie",
    contactEmail: "leewj@email.com",
    contactPhone: "+65 9123 4567",
    groups: [
      {
        id: "PG-001",          // ← This is SeedEntry.id in fixture
        registrationId: "REG-001",
        eventId: "evt-1",
        programId: "prog-1",
        programName: "Men's Singles",
        fee: 80,
        groupStatus: "Pending",
        seed: null,
        clubDisplay: "Pasir Ris BC",
        namesDisplay: "Lee Wei Jie",
        participants: [
          {
            id: "PART-001",
            participantGroupId: "PG-001",
            fullName: "Lee Wei Jie",
            dob: "1998-03-15",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Pasir Ris BC",
            email: "leewj@email.com",
            contactNumber: "+65 9123 4567",
            sbaId: "SBA-001",
            customFieldValues: {},
          }
        ]
      }
    ],
    payment: {
      id: "PAY-001",
      registrationId: "REG-001",
      receiptNo: "",
      method: "Others",
      gateway: "Manual",
      createdAt: "2026-01-10T09:00:00Z",
      paymentStatus: "Pending",
      items: [
        { id: "PI-001", participantGroupId: "PG-001", description: "", programName: "Men's Singles", amount: 80, itemStatus: "Success" }
      ]
    }
  },

  // ── REG-002: Doubles pair, paid ──────────────────────────────────────────
  {
    id: "REG-002",
    eventId: "evt-1",
    eventName: "Singapore Open Badminton Championship 2026",
    submittedAt: "2026-01-12T14:30:00",
    regStatus: "Confirmed",
    contactName: "Ravi Kumar",
    contactEmail: "ravi@email.com",
    contactPhone: "+65 8234 5678",
    groups: [
      {
        id: "PG-002",
        registrationId: "REG-002",
        eventId: "evt-1",
        programId: "prog-3",
        programName: "Men's Doubles",
        fee: 120,
        groupStatus: "Confirmed",
        seed: null,
        clubDisplay: "Tampines BC",
        namesDisplay: "Ravi Kumar / Ahmad Farid",
        participants: [
          {
            id: "PART-002",
            participantGroupId: "PG-002",
            fullName: "Ravi Kumar",
            dob: "1996-07-22",
            gender: "Male",
            nationality: "Singaporean PR",
            clubSchoolCompany: "Tampines BC",
            email: "ravi@email.com",
            contactNumber: "+65 8234 5678",
            sbaId: "SBA-003",
            customFieldValues: {},
          },
          {
            id: "PART-003",
            participantGroupId: "PG-002",
            fullName: "Ahmad Farid",
            dob: "1997-11-08",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Tampines BC",
            sbaId: "SBA-011",
            customFieldValues: {},
          }
        ]
      }
    ],
    payment: {
      id: "PAY-002",
      registrationId: "REG-002",
      receiptNo: "RCP-0001",
      method: "PayNow",
      gateway: "Manual",
      createdAt: "2026-01-10T09:00:00Z",
      paymentStatus: "Success",
      paidDate: "2026-01-12",
      items: [
        { id: "PI-002", participantGroupId: "PG-002", description: "", programName: "Men's Doubles", amount: 120, itemStatus: "Success" }
      ]
    }
  },

  // ── REG-003: Mixed doubles pair, paid ────────────────────────────────────
  {
    id: "REG-003",
    eventId: "evt-1",
    eventName: "Singapore Open Badminton Championship 2026",
    submittedAt: "2026-01-13T10:00:00",
    regStatus: "Confirmed",
    contactName: "Lee Wei Jie",
    contactEmail: "leewj@email.com",
    contactPhone: "+65 9123 4567",
    groups: [
      {
        id: "PG-003",
        registrationId: "REG-003",
        eventId: "evt-1",
        programId: "prog-5",
        programName: "Mixed Doubles",
        fee: 120,
        groupStatus: "Confirmed",
        seed: null,
        clubDisplay: "Pasir Ris BC",
        namesDisplay: "Lee Wei Jie / Tan Mei Ling",
        participants: [
          {
            id: "PART-004",
            participantGroupId: "PG-003",
            fullName: "Lee Wei Jie",
            dob: "1998-03-15",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Pasir Ris BC",
            sbaId: "SBA-001",
            customFieldValues: {},
          },
          {
            id: "PART-005",
            participantGroupId: "PG-003",
            fullName: "Tan Mei Ling",
            dob: "2000-05-20",
            gender: "Female",
            nationality: "Singaporean",
            clubSchoolCompany: "Pasir Ris BC",
            sbaId: "SBA-021",
            customFieldValues: {},
          }
        ]
      }
    ],
    payment: {
      id: "PAY-003",
      registrationId: "REG-003",
      receiptNo: "RCP-0002",
      method: "CreditCard",
      gateway: "Manual",
      createdAt: "2026-01-10T09:00:00Z",
      paymentStatus: "Success",
      paidDate: "2026-01-13",
      items: [
        { id: "PI-003", participantGroupId: "PG-003", description: "", programName: "Mixed Doubles", amount: 120, itemStatus: "Success" }
      ]
    }
  },

  // ── REG-004: One registration, two programs (singles + doubles) ──────────
  //    This is the key scenario: Tan Ah Kow registers for both Men's Singles
  //    and Men's Doubles (with Michael Ng). One receipt covers both.
  {
    id: "REG-004",
    eventId: "evt-1",
    eventName: "Singapore Open Badminton Championship 2026",
    submittedAt: "2026-01-15T08:45:00",
    regStatus: "Confirmed",
    contactName: "Tan Ah Kow",
    contactEmail: "tak@email.com",
    contactPhone: "+65 9345 6789",
    groups: [
      {
        id: "PG-004",          // Men's Singles entry for Tan Ah Kow
        registrationId: "REG-004",
        eventId: "evt-1",
        programId: "prog-1",
        programName: "Men's Singles",
        fee: 80,
        groupStatus: "Confirmed",
        seed: null,
        clubDisplay: "Jurong BC",
        namesDisplay: "Tan Ah Kow",
        participants: [
          {
            id: "PART-006",
            participantGroupId: "PG-004",
            fullName: "Tan Ah Kow",
            dob: "1995-09-12",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Jurong BC",
            email: "tak@email.com",
            contactNumber: "+65 9345 6789",
            sbaId: "SBA-007",
            customFieldValues: {},
          }
        ]
      },
      {
        id: "PG-005",          // Men's Doubles entry for Tan Ah Kow + Michael Ng
        registrationId: "REG-004",
        eventId: "evt-1",
        programId: "prog-3",
        programName: "Men's Doubles",
        fee: 120,
        groupStatus: "Confirmed",
        seed: null,
        clubDisplay: "Jurong BC",
        namesDisplay: "Tan Ah Kow / Michael Ng",
        participants: [
          {
            id: "PART-007",
            participantGroupId: "PG-005",
            fullName: "Tan Ah Kow",
            dob: "1995-09-12",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Jurong BC",
            sbaId: "SBA-007",
            customFieldValues: {},
          },
          {
            id: "PART-008",
            participantGroupId: "PG-005",
            fullName: "Michael Ng",
            dob: "1999-02-28",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Bishan SC",
            sbaId: "SBA-015",
            customFieldValues: {},
          }
        ]
      }
    ],
    payment: {
      id: "PAY-004",
      registrationId: "REG-004",
      receiptNo: "RCP-0003",
      method: "Cash",
      gateway: "Manual",
      createdAt: "2026-01-10T09:00:00Z",
      paymentStatus: "Success",
      paidDate: "2026-01-16",
      remarks: "Cash collected at counter",
      items: [
        { id: "PI-004", participantGroupId: "PG-004", description: "", programName: "Men's Singles",  amount: 80, itemStatus: "Success" },
        { id: "PI-005", participantGroupId: "PG-005", description: "", programName: "Men's Doubles",  amount: 120, itemStatus: "Success" }
      ]
    }
  },

  // ── REG-005: Cancelled + refunded ────────────────────────────────────────
  {
    id: "REG-005",
    eventId: "evt-1",
    eventName: "Singapore Open Badminton Championship 2026",
    submittedAt: "2026-01-08T16:00:00",
    regStatus: "Cancelled",
    contactName: "Rachel Tan",
    contactEmail: "rachel@email.com",
    contactPhone: "+65 9456 7890",
    groups: [
      {
        id: "PG-006",
        registrationId: "REG-005",
        eventId: "evt-1",
        programId: "prog-2",
        programName: "Women's Singles",
        fee: 80,
        groupStatus: "Cancelled",
        seed: null,
        clubDisplay: "Serangoon BC",
        namesDisplay: "Rachel Tan",
        participants: [
          {
            id: "PART-009",
            participantGroupId: "PG-006",
            fullName: "Rachel Tan",
            dob: "2001-06-14",
            gender: "Female",
            nationality: "Singaporean",
            clubSchoolCompany: "Serangoon BC",
            sbaId: "SBA-022",
            customFieldValues: {},
          }
        ]
      }
    ],
    payment: {
      id: "PAY-005",
      registrationId: "REG-005",
      receiptNo: "RCP-0004",
      method: "CreditCard",
      gateway: "Manual",
      createdAt: "2026-01-10T09:00:00Z",
      paymentStatus: "FullyRefunded",
      paidDate: "2026-01-08",
      items: [
        {
          id: "PI-006",
          participantGroupId: "PG-006",
          programName: "Women's Singles",
          amount: 80,
          itemStatus: "Refunded"
        }
      ]
    }
  },

  // ── REG-006: Partial refund (one of two programs refunded) ───────────────
  {
    id: "REG-006",
    eventId: "evt-1",
    eventName: "Singapore Open Badminton Championship 2026",
    submittedAt: "2026-01-18T11:20:00",
    regStatus: "Confirmed",
    contactName: "Wong Xiu Mei",
    contactEmail: "wongxm@email.com",
    contactPhone: "+65 9567 8901",
    groups: [
      {
        id: "PG-007",
        registrationId: "REG-006",
        eventId: "evt-1",
        programId: "prog-2",
        programName: "Women's Singles",
        fee: 80,
        groupStatus: "Confirmed",
        seed: null,
        clubDisplay: "Jurong BC",
        namesDisplay: "Wong Xiu Mei",
        participants: [
          {
            id: "PART-010",
            participantGroupId: "PG-007",
            fullName: "Wong Xiu Mei",
            dob: "1999-11-03",
            gender: "Female",
            nationality: "Singaporean",
            clubSchoolCompany: "Jurong BC",
            sbaId: "SBA-023",
            customFieldValues: {},
          }
        ]
      },
      {
        id: "PG-008",
        registrationId: "REG-006",
        eventId: "evt-1",
        programId: "prog-5",
        programName: "Mixed Doubles",
        fee: 120,
        groupStatus: "Cancelled",
        seed: null,
        clubDisplay: "Jurong BC",
        namesDisplay: "Wong Xiu Mei / Lim Boon Huat",
        participants: [
          {
            id: "PART-011",
            participantGroupId: "PG-008",
            fullName: "Wong Xiu Mei",
            dob: "1999-11-03",
            gender: "Female",
            nationality: "Singaporean",
            clubSchoolCompany: "Jurong BC",
            sbaId: "SBA-023",
            customFieldValues: {},
          },
          {
            id: "PART-012",
            participantGroupId: "PG-008",
            fullName: "Lim Boon Huat",
            dob: "1997-04-17",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Jurong BC",
            sbaId: "SBA-016",
            customFieldValues: {},
          }
        ]
      }
    ],
    payment: {
      id: "PAY-006",
      registrationId: "REG-006",
      receiptNo: "RCP-0005",
      method: "PayNow",
      gateway: "Manual",
      createdAt: "2026-01-10T09:00:00Z",
      paymentStatus: "PartiallyRefunded",
      paidDate: "2026-01-18",
      items: [
        { id: "PI-007", participantGroupId: "PG-007", description: "", programName: "Women's Singles", amount: 80,  itemStatus: "Success" },
        { id: "PI-008", participantGroupId: "PG-008", description: "", programName: "Mixed Doubles",   amount: 120, itemStatus: "Refunded" }
      ]
    }
  },

  // ── REG-007: per_player fee structure — Mixed Doubles $60/player ─────────
  //    Demonstrates: 2 line items (one per player), each $60.
  //    If one player is refunded and 1 remains → drops below minPlayers (2)
  //    → system should warn admin to cancel whole entry instead.
  {
    id: "REG-007",
    eventId: "evt-1",
    eventName: "Singapore Open Badminton Championship 2026",
    submittedAt: "2026-02-01T11:00:00",
    regStatus: "Confirmed",
    contactName: "Ng Swee Huat",
    contactEmail: "ngsh@email.com",
    contactPhone: "+65 9456 7890",
    groups: [
      {
        id: "PG-009",
        registrationId: "REG-007",
        eventId: "evt-1",
        programId: "prog-5",
        programName: "Mixed Doubles",
        fee: 120,          // total = 2 × $60 per player
        groupStatus: "Confirmed",
        seed: null,
        clubDisplay: "Woodlands BC",
        namesDisplay: "Ng Swee Huat / Tan Siew Lin",
        participants: [
          {
            id: "PART-013",
            participantGroupId: "PG-009",
            fullName: "Ng Swee Huat",
            dob: "1994-06-14",
            gender: "Male",
            nationality: "Singaporean",
            clubSchoolCompany: "Woodlands BC",
            email: "ngsh@email.com",
            contactNumber: "+65 9456 7890",
            sbaId: "SBA-031",
            customFieldValues: {},
          },
          {
            id: "PART-014",
            participantGroupId: "PG-009",
            fullName: "Tan Siew Lin",
            dob: "1996-09-28",
            gender: "Female",
            nationality: "Singaporean",
            clubSchoolCompany: "Woodlands BC",
            sbaId: "SBA-032",
            customFieldValues: {},
          }
        ]
      }
    ],
    payment: {
      id: "PAY-007",
      registrationId: "REG-007",
      receiptNo: "RCP-0006",
      method: "PayNow",
      gateway: "Manual",
      createdAt: "2026-01-10T09:00:00Z",
      paymentStatus: "Success",
      paidDate: "2026-02-01",
      items: [
        // per_player: one line item per participant, participantId populated
        { id: "PI-009", participantGroupId: "PG-009", description: "", participantId: "PART-013", playerName: "Ng Swee Huat",  programName: "Mixed Doubles (per player)", amount: 60, itemStatus: "Success" },
        { id: "PI-010", participantGroupId: "PG-009", description: "", participantId: "PART-014", playerName: "Tan Siew Lin", programName: "Mixed Doubles (per player)", amount: 60, itemStatus: "Success" },
      ]
    }
  },
];

// ── Per-program lookup (for fixture system) ──────────────────────────────────

/**
 * Get all ParticipantGroups for a specific program.
 * This replaces Program.participantSeeds[] in config.json.
 * The fixture wizard receives these directly.
 */
export function getGroupsForProgram(
  registrations: Registration[],
  eventId:    string,
  programId:  string
): import("@/types/registration").ParticipantGroup[] {
  return registrations
    .flatMap(r => r.groups)
    .filter(g => g.eventId === eventId && g.programId === programId && g.groupStatus !== "Cancelled");
}

/**
 * Convert ParticipantGroups to SeedEntries for the fixture wizard.
 */
export function toSeedEntries(groups: import("@/types/registration").ParticipantGroup[]) {
  return groups.map(g => ({
    id:           g.id,
    club:         g.clubDisplay,
    participants: g.participants.map(p => p.fullName),
    seed:         g.seed,
    sbaId:        g.participants[0]?.sbaId,
  }));
}