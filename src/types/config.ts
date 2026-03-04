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

export interface Program {
  id: string;
  name: string;
  type: string;          // Knockout | Group Stage + Knockout | Round Robin | League
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
}

export interface TournamentEvent {
  id: string;
  name: string;
  description: string;
  venue: string;
  venueAddress: string;
  bannerUrl: string;
  galleryUrls: string[];           // ✅ REQUIRED
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



export interface AdminUser {
  id: string;
  email: string;
  password: string;       // plaintext for mock; backend will hash
  role: "superadmin" | "eventadmin";
  name: string;
  lastLogin?: string;
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

export type EventStatus = "open" | "upcoming" | "closed";
export type ProgramStatus = "open" | "upcoming" | "closed" | "full" | "nearly_full";

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

// Payment structures
export type PaymentMethod = "Credit Card" | "PayNow" | "Cash" | "Bank Transfer" | "Others";
export type PaymentStatus = "Pending" | "Paid" | "Refunded" | "Partially Refunded";
export type RefundStatus  = "None" | "Full" | "Partial";

export interface PaymentLineItem {
  id: string;
  label: string;          // e.g. "Registration Fee — Men's Singles"
  amount: number;
  refundedAmount: number;
  refundStatus: RefundStatus;
  refundDate?: string;
  refundReason?: string;
}

export interface PaymentRecord {
  id: string;               // TXN-001
  registrationId: string;   // R001
  event: string;
  program: string;
  participants: string;
  method: PaymentMethod;
  paidDate: string;
  receiptNumber: string;
  lineItems: PaymentLineItem[];
  paymentStatus: PaymentStatus;
}