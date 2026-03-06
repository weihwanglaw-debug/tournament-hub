// ── Custom field + program field config ──────────────────────────────────────

export interface CustomField {
  label: string;
  type: string;         // text | number | date | select
  required: boolean;
  options?: string;     // comma-separated for select type
}

export interface ProgramFields {
  enableSbaId: boolean;
  enableDocumentUpload: boolean;
  enableGuardianInfo: boolean;
  enableRemark?: boolean;
  customFields: CustomField[];
}

// ── Fixture types ─────────────────────────────────────────────────────────────

export type FixtureFormat =
  | "knockout"           // straight single-elimination
  | "sectional_knockout" // N sections each run KO → winners play final KO
  | "group_knockout"     // group stage (round-robin) → top N advance to KO
  | "round_robin"        // everyone plays everyone, standings only
  | "league"             // round-robin with home/away
  | "heats_final";       // qualifying heats → A/B/C finals

export type ScoringRuleId =
  | "badminton_21"   // best of 3, 21pts, win by 2, deuce to 30
  | "badminton_30"   // best of 3, 30pts, sudden death at 29-all
  | "football_90"    // 90 min, extra time 30 min, goals
  | "tennis_sets"    // best of 3 or 5 sets
  | "swimming_time"  // fastest time wins
  | "sets_3"         // generic best-of-3 sets
  | "sets_5";        // generic best-of-5 sets

export type TiebreakCriteria =
  | "head_to_head"
  | "game_ratio"
  | "point_ratio"
  | "goal_difference"
  | "goals_scored"
  | "fastest_time";

export interface FixtureFormatConfig {

  // knockout
  seedingMethod?:     "snake" | "random" | "manual";
  byeHandling?:       "top_seed_gets_bye" | "random";

  // sectional_knockout
  numSections?:       number;

  // group_knockout
  numGroups?:         number;
  advancePerGroup?:   number;
  crossGroupPairing?: "bwf" | "standard" | "fifa";

  // round_robin / league
  pointsForWin?:      number;
  pointsForDraw?:     number;
  homeAndAway?:       boolean;
  tiebreakOrder?:     TiebreakCriteria[];

  // heats_final
  numHeats?:          number;
  qualifyPerHeat?:    number;
  numFinalsGroups?:   number;
}

// ── Program ───────────────────────────────────────────────────────────────────

export interface Program {
  id: string;
  name: string;
  /** @deprecated use fixtureFormat + scoringRule instead. Kept for display label. */
  type: string;
  minAge: number;
  maxAge: number;
  gender: string;
  fee: number;
  paymentRequired: boolean;
  sbaRequired?: boolean;
  minPlayers: number;
  maxPlayers: number;
  minParticipants: number;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  fields: ProgramFields;

  // Fixture configuration — set at program creation time
  fixtureFormat?: FixtureFormat;       // defaults to "knockout" if absent
  formatConfig?:  FixtureFormatConfig; // format-specific settings
  scoringRule?:   ScoringRuleId;       // defaults to "badminton_21" if absent
  maxSeeds?:      number;              // max number of seeded participants (0 = no seeding)
  participantSeeds?: SeedEntry[];      // pre-loaded from registrations
}

// ── Event ─────────────────────────────────────────────────────────────────────

export interface TournamentEvent {
  id: string;
  name: string;
  description: string;
  venue: string;
  venueAddress: string;
  bannerUrl: string;
  galleryUrls: string[];
  prospectusUrl: string;
  eventStartDate: string;
  eventEndDate: string;
  openDate: string;
  closeDate: string;
  maxParticipants: number;
  sponsorInfo: string;
  consentStatement: string;
  isSports: boolean;
  sportType: string;
  fixtureMode: "internal" | "external";
  programs: Program[];
}

// ── Users / config ────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  password: string;       // plaintext for mock; backend will hash
  role: "superadmin" | "eventadmin";
  name: string;
  lastLogin?: string;
  mustChangePassword?: boolean;
}

export interface ConfigEntry {
  key: string;
  label: string;
  value: string;
  group: string;
}

export interface Config {
  branding: { logoUrl: string; appName: string };
  hero: { title: string; subtitle: string };
  nav: { menuItems: { label: string; href: string }[] };
  footer: {
    socialLinks: { platform: string; url: string }[];
    contactEmail: string;
    copyrightText: string;
    extraLinks?: { label: string; href: string }[];
  };
  consentText: string;
  payment: { currency: string };
  events: TournamentEvent[];
  admin: { users: AdminUser[] };
}

export type EventStatus   = "open" | "upcoming" | "closed";
export type ProgramStatus = "open" | "upcoming" | "closed" | "full" | "nearly_full";

// ── Registration / participant types ─────────────────────────────────────────

export interface Participant {
  id: string;
  fullName: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  gender: string;
  email: string;
  contactNumber: string;
  nationality: string;
  clubSchoolCompany: string;
  tshirtSize: string;
  sbaId?: string;
  guardianName?: string;
  guardianContact?: string;
  documentFile?: File | null;
  remark?: string;
  customFieldValues: Record<string, string>;
}

export interface CartEntry {
  programId: string;
  programName: string;
  fee: number;
  participants: Participant[];
}

// ── Payment types ─────────────────────────────────────────────────────────────

export type PaymentMethod = "Credit Card" | "PayNow" | "Cash" | "Bank Transfer" | "Others";
export type PaymentStatus = "Pending" | "Paid" | "Refunded" | "Partially Refunded";
export type RefundStatus  = "None" | "Full" | "Partial";

export interface PaymentLineItem {
  id: string;
  label: string;
  amount: number;
  refundedAmount: number;
  refundStatus: RefundStatus;
  refundDate?: string;
  refundReason?: string;
}

export interface PaymentRecord {
  id: string;
  registrationId: string;
  event: string;
  program: string;
  participants: string;
  method: PaymentMethod;
  paidDate: string;
  receiptNumber: string;
  lineItems: PaymentLineItem[];
  paymentStatus: PaymentStatus;
}

// ── Fixture engine types ──────────────────────────────────────────────────────

export type MatchStatus = "Scheduled" | "In Progress" | "Completed" | "Walkover";
export type MatchPhase  = "section" | "group" | "knockout";

export interface GameScore {
  p1: string;
  p2: string;
}

export interface Official {
  id: string;
  role: string;
  name: string;
}

export interface TeamEntry {
  id: string;
  label: string;          // club / school / company
  participants: string[]; // player display names
  seed?: number;
}

export interface MatchEntry {
  id: string;
  phase: MatchPhase;
  round: number;
  roundLabel: string;     // "Round 1" | "Quarter-Final" | "Semi-Final" | "Final"
  groupId?: string;       // "A" | "B" | "C" | "D" — group phase only
  sectionId?: string;     // "A" | "B" | "C" | "D" — sectional KO only
  team1: TeamEntry;
  team2: TeamEntry;
  games: GameScore[];
  winner: "team1" | "team2" | null;
  walkover: boolean;
  walkoverWinner: "team1" | "team2" | "";
  startTime: string;
  endTime: string;
  officials: Official[];
  status: MatchStatus;
  expanded: boolean;
}

export interface SeedEntry {
  id: string;
  club: string;
  participants: string[];
  seed: number | null;
}

export interface GroupStanding {
  team: TeamEntry;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  gamesFor: number;
  gamesAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
  rank: number;
}

export interface GroupEntry {
  id: string;   // "A" | "B" | "C" | "D"
  name: string; // "Group A"
  teams: TeamEntry[];
  matches: MatchEntry[];
}

export interface SectionEntry {
  id: string;   // "A" | "B" | "C" | "D"
  name: string; // "Section A"
  teams: TeamEntry[];
  matches: MatchEntry[];
}

export interface BracketState {
  format: FixtureFormat;
  config: FixtureFormatConfig;
  scoringRule: ScoringRuleId;
  locked: boolean;           // true = first score saved, draw is frozen
  phase: "seeding" | "group" | "knockout" | "complete";
  groups: GroupEntry[];      // group_knockout | round_robin | league
  sections: SectionEntry[];  // sectional_knockout
  matches: MatchEntry[];     // all KO phase matches
  seeds: SeedEntry[];
}