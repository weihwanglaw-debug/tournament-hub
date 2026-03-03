export interface CustomField {
  label: string;
  type: string;
  required: boolean;
}

export interface ProgramFields {
  enableSbaId: boolean;
  enableDocumentUpload: boolean;
  enableGuardianInfo: boolean;
  customFields: CustomField[];
}

export interface Program {
  id: string;
  name: string;
  type: string;
  minAge: number;
  maxAge: number;
  gender: string;
  fee: number;
  minPlayers: number;
  maxPlayers: number;
  maxParticipants: number;
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
  prospectusUrl: string;
  eventStartDate: string;
  eventEndDate: string;
  openDate: string;
  closeDate: string;
  maxParticipants: number;
  sponsorInfo: string;
  consentStatement: string;
  programs: Program[];
}

export interface AdminUser {
  email: string;
  password: string;
  role: string;
  name: string;
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
  sbaId?: string;
  guardianName?: string;
  guardianContact?: string;
  documentFile?: File | null;
  customFieldValues: Record<string, string>;
}

export interface CartEntry {
  programId: string;
  programName: string;
  fee: number;
  participants: Participant[];
}
