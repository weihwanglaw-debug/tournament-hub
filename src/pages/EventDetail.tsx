import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, MapPin, Users, Download, ArrowLeft,
  ShoppingCart, Plus, Trash2, AlertCircle, Edit2,
  Search, CheckCircle, XCircle, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent, Program, Participant, CartEntry } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge, { getProgramCapacityStatus } from "@/components/events/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

import eventBanner1 from "@/assets/event-banner-1.jpg";
import eventBanner2 from "@/assets/event-banner-2.jpg";
import eventBanner3 from "@/assets/event-banner-3.jpg";

const FALLBACK_BANNERS = [eventBanner1, eventBanner2, eventBanner3];

// ── SBA Master list (mock) ──
const SBA_MASTER: Record<string, { fullName: string; dob: string; gender: string; clubSchoolCompany: string }> = {
  "SBA-001": { fullName: "Lee Wei Jie",   dob: "1998-04-12", gender: "Male",   clubSchoolCompany: "Pasir Ris Badminton Club"  },
  "SBA-002": { fullName: "Tan Mei Ling",  dob: "2000-07-25", gender: "Female", clubSchoolCompany: "Tampines Badminton Club"   },
  "SBA-003": { fullName: "Ravi Kumar",    dob: "1995-11-03", gender: "Male",   clubSchoolCompany: "Jurong Badminton Club"     },
  "SBA-004": { fullName: "Wong Xiu Ying", dob: "2002-02-18", gender: "Female", clubSchoolCompany: "Bishan Sports Club"       },
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => String(currentYear - i));
const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

function generateId() { return Math.random().toString(36).slice(2, 10); }

function blankParticipant(): Participant {
  return {
    id: generateId(), fullName: "", dobDay: "", dobMonth: "", dobYear: "",
    gender: "", email: "", contactNumber: "", nationality: "",
    clubSchoolCompany: "", tshirtSize: "", sbaId: "",
    guardianName: "", guardianContact: "", documentFile: null, remark: "",
    customFieldValues: {},
  };
}

// ── Gallery Component ──
function EventGallery({ images }: { images: string[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="font-bold text-xl mb-6">Gallery</h2>
      {images.length === 1 ? (
        <div
          className="relative w-full overflow-hidden cursor-pointer group"
          style={{ border: "1px solid var(--color-table-border)", maxHeight: "400px" }}
          onClick={() => setLightboxIdx(0)}
        >
          <img src={images[0]} alt="Event gallery" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />
        </div>
      ) : (
        <div className={`grid gap-3 ${
          images.length === 2 ? "grid-cols-2" :
          images.length === 3 ? "grid-cols-2 md:grid-cols-3" :
          "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        }`}>
          {images.map((img, i) => (
            <div
              key={i}
              className={`relative overflow-hidden cursor-pointer group ${
                i === 0 && images.length === 3 ? "col-span-2 md:col-span-1" : ""
              }`}
              style={{ border: "1px solid var(--color-table-border)" }}
              onClick={() => setLightboxIdx(i)}
            >
              <div className="aspect-video">
                <img src={img} alt={`Gallery ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                <Search className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white" onClick={() => setLightboxIdx(null)}>
            <X className="h-6 w-6" />
          </button>
          {images.length > 1 && (
            <>
              <button className="absolute left-4 p-2 text-white/70 hover:text-white"
                onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + images.length) % images.length); }}>
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button className="absolute right-4 p-2 text-white/70 hover:text-white"
                onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % images.length); }}>
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}
          <img src={images[lightboxIdx]} alt="" className="max-w-full max-h-[85vh] object-contain" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-4 text-white/60 text-sm">{lightboxIdx + 1} / {images.length}</div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const registrationRef = useRef<HTMLDivElement>(null);

  const event = (config.events as TournamentEvent[]).find((e) => e.id === id);
  const eventIndex = (config.events as TournamentEvent[]).findIndex((e) => e.id === id);

  // Registration state
  const [step, setStep] = useState(1);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [existingParticipants, setExistingParticipants] = useState<Participant[]>([]);
  const [suggestions, setSuggestions] = useState<{ idx: number; matches: Participant[] } | null>(null);
  const [sbaStatus, setSbaStatus] = useState<Record<number, "idle" | "loading" | "found" | "not_found">>({});
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const status = event ? getEventStatus(event) : "closed";
  const currency = config.payment.currency || "SGD";
  const totalPrice = cart.reduce((sum, e) => sum + e.fee, 0);

  const bannerImage = event?.bannerUrl || FALLBACK_BANNERS[eventIndex % FALLBACK_BANNERS.length];

  // Gallery: use event gallery URLs, or fallback to banners for demo
  const galleryImages = useMemo(() => {
    if (event?.galleryUrls && event.galleryUrls.length > 0) return event.galleryUrls;
    // Demo: show 3 sample images for events that have no gallery
    return FALLBACK_BANNERS;
  }, [event]);

  // ── Program selection with scroll ──
  const handleSelectProgram = (prog: Program) => {
    setSelectedProgram(prog);
    const initial = Array.from({ length: prog.minPlayers }, () => blankParticipant());
    setParticipants(initial);
    setErrors({});
    setFormError("");
    setSbaStatus({});
    setSuggestions(null);
    setStep(2);
    // Scroll to registration section
    setTimeout(() => {
      registrationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // ── Participant field updates ──
  const updateParticipant = (idx: number, field: string, value: string) => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
    if (field === "fullName" && value.length >= 3) {
      const matches = existingParticipants.filter((ep) =>
        ep.fullName.toLowerCase().startsWith(value.toLowerCase())
      );
      if (matches.length > 0) setSuggestions({ idx, matches });
      else setSuggestions(null);
    } else if (field === "fullName") { setSuggestions(null); }
  };

  const updateCustomField = (idx: number, label: string, value: string) => {
    setParticipants((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, customFieldValues: { ...p.customFieldValues, [label]: value } } : p
      )
    );
  };

  const applyAutoFill = (participantIdx: number, existing: Participant) => {
    setParticipants((prev) =>
      prev.map((p, i) => i === participantIdx ? { ...existing, id: p.id, documentFile: null } : p)
    );
    setSuggestions(null);
  };

  const addParticipant = () => {
    if (!selectedProgram || participants.length >= selectedProgram.maxPlayers) return;
    setParticipants((prev) => [...prev, blankParticipant()]);
  };

  const removeParticipant = (idx: number) => {
    if (!selectedProgram || participants.length <= selectedProgram.minPlayers) return;
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── SBA ID retrieve ──
  const retrieveBySbaId = (idx: number, sbaId: string) => {
    if (!sbaId.trim()) return;
    setSbaStatus((prev) => ({ ...prev, [idx]: "loading" }));
    setTimeout(() => {
      const found = SBA_MASTER[sbaId.trim()];
      if (found) {
        const [year, month, day] = found.dob.split("-");
        setParticipants((prev) =>
          prev.map((p, i) =>
            i === idx ? { ...p, fullName: found.fullName, dobDay: day,
              dobMonth: MONTHS[parseInt(month, 10) - 1], dobYear: year,
              gender: found.gender, clubSchoolCompany: found.clubSchoolCompany } : p
          )
        );
        setSbaStatus((prev) => ({ ...prev, [idx]: "found" }));
      } else {
        setSbaStatus((prev) => ({ ...prev, [idx]: "not_found" }));
      }
    }, 500);
  };

  // ── Validation ──
  const validate = (): boolean => {
    if (!selectedProgram) return false;
    const errs: Record<string, string> = {};
    let formErr = "";
    if (selectedProgram.currentParticipants >= selectedProgram.maxParticipants) {
      formErr = "This program is full.";
      setErrors(errs); setFormError(formErr); return false;
    }
    participants.forEach((p, i) => {
      const px = `p${i}`;
      if (!p.fullName.trim()) errs[`${px}.fullName`] = "Required";
      if (!p.dobDay || !p.dobMonth || !p.dobYear) errs[`${px}.dob`] = "Complete date required";
      if (!p.gender) errs[`${px}.gender`] = "Required";
      if (!p.email.trim()) errs[`${px}.email`] = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errs[`${px}.email`] = "Invalid email";
      if (!p.contactNumber.trim()) errs[`${px}.contactNumber`] = "Required";
      if (!p.nationality.trim()) errs[`${px}.nationality`] = "Required";
      if (!p.clubSchoolCompany.trim()) errs[`${px}.clubSchoolCompany`] = "Required";
      if (!p.tshirtSize) errs[`${px}.tshirtSize`] = "Required";
      if (p.dobDay && p.dobMonth && p.dobYear) {
        const monthIdx = MONTHS.indexOf(p.dobMonth);
        const dob = new Date(+p.dobYear, monthIdx, +p.dobDay);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const mDiff = today.getMonth() - dob.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
        if (age < selectedProgram.minAge || age > selectedProgram.maxAge)
          errs[`${px}.dob`] = `Age must be ${selectedProgram.minAge}–${selectedProgram.maxAge}`;
      }
      if (p.gender && selectedProgram.gender !== "Mixed") {
        if (selectedProgram.gender === "Male" && p.gender !== "Male") errs[`${px}.gender`] = "Male players only";
        if (selectedProgram.gender === "Female" && p.gender !== "Female") errs[`${px}.gender`] = "Female players only";
      }
      if (selectedProgram.fields.enableGuardianInfo) {
        if (!p.guardianName?.trim()) errs[`${px}.guardianName`] = "Required";
        if (!p.guardianContact?.trim()) errs[`${px}.guardianContact`] = "Required";
      }
      selectedProgram.fields.customFields.forEach((cf) => {
        if (cf.required && !p.customFieldValues[cf.label]?.trim())
          errs[`${px}.custom.${cf.label}`] = "Required";
      });
      const dupe = cart.some((entry, ci) => {
        if (editingCartIndex !== null && ci === editingCartIndex) return false;
        return entry.programId === selectedProgram.id &&
          entry.participants.some((ep) => ep.fullName === p.fullName && ep.dobDay === p.dobDay && ep.dobMonth === p.dobMonth && ep.dobYear === p.dobYear);
      });
      if (dupe) errs[`${px}.fullName`] = "Already registered in this program";
    });
    if (
        selectedProgram.gender === "Mixed" &&
        selectedProgram.maxPlayers === 2 &&
        participants.length === 2 &&
        participants.every(p => p.gender)   // ← guard
      ) {
      const genders = participants.map((p) => p.gender);
      if (!(genders.includes("Male") && genders.includes("Female")))
        formErr = "Mixed Doubles requires exactly 1 Male and 1 Female player.";
    }
    setErrors(errs); setFormError(formErr);
    return Object.keys(errs).length === 0 && !formErr;
  };

  // ── Add to cart ──
  const addToCart = () => {
    if (!selectedProgram) return;
    const entry: CartEntry = { programId: selectedProgram.id
      , programName: selectedProgram.name
      , fee: selectedProgram.paymentRequired ? selectedProgram.fee : 0
      , participants: [...participants] };

    if (editingCartIndex !== null) {
      setCart((prev) => prev.map((c, i) => (i === editingCartIndex ? entry : c)));
      setEditingCartIndex(null);
    } else { setCart((prev) => [...prev, entry]); }
    participants.forEach((p) => {
      const exists = existingParticipants.some((ep) => ep.fullName === p.fullName && ep.dobDay === p.dobDay && ep.dobYear === p.dobYear);
      if (!exists) setExistingParticipants((prev) => [...prev, { ...p }]);
    });
    setSelectedProgram(null); setParticipants([]); setErrors({}); setFormError(""); setSbaStatus({}); setStep(3);
  };

  const handleAddToCart = () => { if (validate()) addToCart(); };

  const handleOverride = () => {
    if (overrideReason.trim().length < 10) return;
    console.log("[AUDIT]", { timestamp: new Date().toISOString(), admin: user?.name, fieldOverridden: Object.keys(errors).join(", "), formError, overrideReason });
    setErrors({}); setFormError(""); setOverrideOpen(false); setOverrideReason(""); addToCart();
  };

  const removeCartEntry = (idx: number) => { setCart((prev) => prev.filter((_, i) => i !== idx)); };
  const editCartEntry = (idx: number) => {
    const entry = cart[idx];
    const prog = event?.programs.find((p) => p.id === entry.programId);
    if (!prog) return;
    setSelectedProgram(prog); setParticipants([...entry.participants]); setEditingCartIndex(idx);
    setErrors({}); setFormError(""); setSbaStatus({}); setSuggestions(null); setStep(2);
    setTimeout(() => registrationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
            <button onClick={() => navigate("/")} className="btn-primary px-5 py-2.5 text-sm">Back to Home</button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16" style={{ backgroundColor: "var(--color-page-bg)" }}>

        {/* ── Banner Hero ── */}
        <div className="relative" style={{ minHeight: "320px" }}>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bannerImage})` }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 100%)" }} />
          <div className="relative z-10 max-w-5xl mx-auto px-8 py-14">
            <button onClick={() => navigate("/")}
              className="flex items-center gap-1 text-sm mb-5 text-white/70 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to events
            </button>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start gap-3 mb-3 flex-wrap">
                <h1 className="font-bold text-3xl md:text-4xl text-white">{event.name}</h1>
                <StatusBadge status={status} />
              </div>
              <p className="text-white/80 max-w-2xl text-base">{event.description}</p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto py-12 px-8">

          {/* ── Section 1: Event Info ── */}
          <div className="grid md:grid-cols-2 gap-10 mb-12">
            <div className="space-y-5">
              <InfoRow icon={Calendar} label="Event Dates" value={`${formatDate(event.eventStartDate)} – ${formatDate(event.eventEndDate)}`} />
              <InfoRow icon={MapPin} label="Venue" value={`${event.venue}, ${event.venueAddress}`} />
              <InfoRow icon={Users} label="Max Participants" value={String(event.maxParticipants)} />
              <InfoRow icon={Calendar} label="Registration Period" value={`${formatDate(event.openDate)} – ${formatDate(event.closeDate)}`} />
              {event.sponsorInfo && <p className="text-sm opacity-70 italic">{event.sponsorInfo}</p>}
            </div>
            <div className="flex flex-col gap-4">
              {event.prospectusUrl && (
                <a href={event.prospectusUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm w-fit">
                  <Download className="h-4 w-4" /> Download Prospectus
                </a>
              )}
              {status === "upcoming" && (
                <div className="p-4 text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
                  Registration opens on {formatDate(event.openDate)}
                </div>
              )}
              {status === "closed" && (
                <div className="p-4 text-sm" style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)" }}>Registration Closed</div>
              )}
            </div>
          </div>

          {/* Google Maps embed */}
          {event.venueAddress && (
            <div className="mb-12 overflow-hidden" style={{ border: "1px solid var(--color-table-border)", height: "200px" }}>
              <iframe title="Venue Map" width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(event.venue + " " + event.venueAddress)}&output=embed`} />
            </div>
          )}

          {/* ── Gallery Section ── */}
          <EventGallery images={galleryImages} />

          {/* ── Section 2: Program Cards ── */}
          <h2 className="font-bold text-xl mb-6">Programs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {event.programs.map((prog) => {
              const capStatus = getProgramCapacityStatus(prog);
              const isFull = capStatus === "full";
              const canRegister = status === "open" && !isFull;
              return (
                <div key={prog.id} className="flex flex-col"
                  style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                  <div className="h-1" style={{ backgroundColor: "var(--color-primary)" }} />
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <h3 className="font-bold text-base leading-tight flex-1">{prog.name}</h3>
                      <StatusBadge status={capStatus} />
                    </div>
                    <div className="space-y-1.5 text-xs mb-4" style={{ color: "var(--color-body-text)" }}>
                      <div className="flex items-center gap-2"><span className="opacity-50">Type</span><span className="font-medium">{prog.type}</span></div>
                      <div className="flex items-center gap-2"><span className="opacity-50">Gender</span><span className="font-medium">{prog.gender}</span></div>
                      <div className="flex items-center gap-2"><span className="opacity-50">Age</span><span className="font-medium">{prog.minAge}–{prog.maxAge} yrs</span></div>
                      <div className="flex items-center gap-2"><span className="opacity-50">Players</span>
                        <span className="font-medium">{prog.minPlayers === prog.maxPlayers ? prog.maxPlayers : `${prog.minPlayers}–${prog.maxPlayers}`} per entry</span>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--color-table-border)" }}>
                      <span className="font-bold text-lg" style={{ color: "var(--color-primary)" }}>{currency} ${prog.fee}</span>
                      <button disabled={!canRegister} onClick={() => handleSelectProgram(prog)}
                        className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                        {isFull ? "Full" : "Register"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Section 3: Registration Steps ── */}
          {status === "open" && (
            <div className="section-anchor" id="registration" ref={registrationRef}>
              <div className="h-px mb-12" style={{ backgroundColor: "var(--color-table-border)" }} />
              <div className="flex items-center gap-3 mb-10">
                {[{ n: 1, label: "Program" }, { n: 2, label: "Participants" }, { n: 3, label: "Cart" }].map((s) => (
                  <div key={s.n} className="flex items-center gap-3">
                    <div className="w-9 h-9 flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: step >= s.n ? "var(--color-primary)" : "var(--color-table-border)",
                        color: step >= s.n ? "var(--color-hero-text)" : "var(--color-body-text)",
                      }}>{s.n}</div>
                    <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                    {s.n < 3 && <div className="w-10 h-px" style={{ backgroundColor: "var(--color-table-border)" }} />}
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && !selectedProgram && (
                  <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <p className="text-sm opacity-60">Select a program above to begin registration.</p>
                  </motion.div>
                )}

                {step === 2 && selectedProgram && (
                  <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-lg">{editingCartIndex !== null ? "Edit: " : ""}{selectedProgram.name} — Participant Details</h3>
                      <button onClick={() => { setStep(cart.length > 0 ? 3 : 1); setSelectedProgram(null); setEditingCartIndex(null); }}
                        className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>Cancel</button>
                    </div>
                    {formError && (
                      <div className="flex items-center gap-2 p-4 mb-5 text-sm" style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                        <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
                      </div>
                    )}
                    {isAuthenticated && (Object.keys(errors).length > 0 || formError) && (
                      <div className="mb-5">
                        <button onClick={() => setOverrideOpen(true)}
                          className="btn-outline px-4 py-2 text-xs font-semibold"
                          style={{ borderColor: "var(--badge-soon-text)", color: "var(--badge-soon-text)" }}>
                          Override Validation (Admin)
                        </button>
                      </div>
                    )}

                    {participants.map((p, idx) => (
                      <div key={p.id} className="p-6 mb-5" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-sm">Player {idx + 1}</h4>
                          {participants.length > selectedProgram.minPlayers && (
                            <button onClick={() => removeParticipant(idx)} className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100">
                              <Trash2 className="h-3 w-3" /> Remove
                            </button>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-5">
                          <Field label="Full Name (as per NRIC/Passport)" error={errors[`p${idx}.fullName`]}>
                            <div className="relative">
                              <input className="field-input" value={p.fullName}
                                onChange={(e) => updateParticipant(idx, "fullName", e.target.value)} autoComplete="off" />
                              {suggestions?.idx === idx && suggestions.matches.length > 0 && (
                                <div className="absolute z-20 w-full shadow-lg"
                                  style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)", top: "100%" }}>
                                  {suggestions.matches.map((m) => (
                                    <button key={m.id} type="button" onClick={() => applyAutoFill(idx, m)}
                                      className="w-full text-left px-3 py-2.5 text-xs hover:opacity-70 transition-opacity"
                                      style={{ borderBottom: "1px solid var(--color-table-border)" }}>
                                      <span className="font-semibold">{m.fullName}</span>
                                      <span className="opacity-60 ml-2">{m.dobDay} {m.dobMonth} {m.dobYear}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </Field>
                          <Field label="Date of Birth" error={errors[`p${idx}.dob`]}>
                            <div className="flex gap-2">
                              <select className="field-input flex-1" value={p.dobDay} onChange={(e) => updateParticipant(idx, "dobDay", e.target.value)}>
                                <option value="">Day</option>{DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                              </select>
                              <select className="field-input flex-1" value={p.dobMonth} onChange={(e) => updateParticipant(idx, "dobMonth", e.target.value)}>
                                <option value="">Month</option>{MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <select className="field-input flex-1" value={p.dobYear} onChange={(e) => updateParticipant(idx, "dobYear", e.target.value)}>
                                <option value="">Year</option>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                          </Field>
                          <Field label="Gender" error={errors[`p${idx}.gender`]}>
                            <select className="field-input" value={p.gender} onChange={(e) => updateParticipant(idx, "gender", e.target.value)}>
                              <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option>
                            </select>
                          </Field>
                          <Field label="Email" error={errors[`p${idx}.email`]}>
                            <input type="email" className="field-input" value={p.email} onChange={(e) => updateParticipant(idx, "email", e.target.value)} />
                          </Field>
                          <Field label="Contact Number" error={errors[`p${idx}.contactNumber`]}>
                            <input className="field-input" value={p.contactNumber} onChange={(e) => updateParticipant(idx, "contactNumber", e.target.value)} />
                          </Field>
                          <Field label="Nationality" error={errors[`p${idx}.nationality`]}>
                            <input className="field-input" value={p.nationality} onChange={(e) => updateParticipant(idx, "nationality", e.target.value)} />
                          </Field>
                          <Field label="Club / School / Company" error={errors[`p${idx}.clubSchoolCompany`]}>
                            <input className="field-input" value={p.clubSchoolCompany} onChange={(e) => updateParticipant(idx, "clubSchoolCompany", e.target.value)} />
                          </Field>
                          <Field label="T-Shirt Size" error={errors[`p${idx}.tshirtSize`]}>
                            <select className="field-input" value={p.tshirtSize} onChange={(e) => updateParticipant(idx, "tshirtSize", e.target.value)}>
                              <option value="">Select</option>{TSHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </Field>
                          {selectedProgram.fields.enableSbaId && (
                            <div className="sm:col-span-2">
                              <Field label="SBA ID">
                                <div className="flex gap-2">
                                  <input className="field-input flex-1" value={p.sbaId || ""}
                                    onChange={(e) => { updateParticipant(idx, "sbaId", e.target.value); setSbaStatus((prev) => ({ ...prev, [idx]: "idle" })); }}
                                    placeholder="e.g. SBA-001" />
                                  <button type="button" onClick={() => retrieveBySbaId(idx, p.sbaId || "")}
                                    disabled={sbaStatus[idx] === "loading"}
                                    className="btn-primary px-4 py-2 text-xs font-semibold whitespace-nowrap disabled:opacity-60">
                                    {sbaStatus[idx] === "loading" ? "Loading…" : "Retrieve →"}
                                  </button>
                                </div>
                                {sbaStatus[idx] === "found" && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--badge-open-text)" }}><CheckCircle className="h-3 w-3" /> Details retrieved ✓</p>}
                                {sbaStatus[idx] === "not_found" && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--badge-open-text)" }}><XCircle className="h-3 w-3" /> SBA ID not found.</p>}
                              </Field>
                            </div>
                          )}
                          {selectedProgram.fields.enableGuardianInfo && (
                            <>
                              <Field label="Guardian Name" error={errors[`p${idx}.guardianName`]}>
                                <input className="field-input" value={p.guardianName || ""} onChange={(e) => updateParticipant(idx, "guardianName", e.target.value)} />
                              </Field>
                              <Field label="Guardian Contact Number" error={errors[`p${idx}.guardianContact`]}>
                                <input className="field-input" value={p.guardianContact || ""} onChange={(e) => updateParticipant(idx, "guardianContact", e.target.value)} />
                              </Field>
                            </>
                          )}
                          {selectedProgram.fields.enableDocumentUpload && (
                            <Field label="Document Upload (PDF/JPG/PNG)">
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="field-input"
                                onChange={(e) => { const file = e.target.files?.[0] || null; setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, documentFile: file } : pp)); }} />
                            </Field>
                          )}
                          {selectedProgram.fields.customFields.map((cf) => (
                            <Field key={cf.label} label={cf.label} error={errors[`p${idx}.custom.${cf.label}`]}>
                              <input className="field-input" value={p.customFieldValues[cf.label] || ""} onChange={(e) => updateCustomField(idx, cf.label, e.target.value)} />
                            </Field>
                          ))}
                          {selectedProgram.fields.enableRemark && (
                            <div className="sm:col-span-2">
                              <Field label="Remark">
                                <textarea className="field-input" rows={2} value={p.remark || ""} onChange={(e) => updateParticipant(idx, "remark", e.target.value)} />
                              </Field>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {participants.length < selectedProgram.maxPlayers && (
                      <button onClick={addParticipant} className="flex items-center gap-2 text-sm font-medium mb-8" style={{ color: "var(--color-primary)" }}>
                        <Plus className="h-4 w-4" /> Add Player
                      </button>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => { setStep(cart.length > 0 ? 3 : 1); setSelectedProgram(null); setEditingCartIndex(null); }}
                        className="btn-outline px-6 py-2.5 text-sm font-medium">Back</button>
                      <button onClick={handleAddToCart} className="btn-primary px-6 py-2.5 text-sm font-semibold">
                        {editingCartIndex !== null ? "Update Cart" : "Add to Cart"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <div className="flex items-center gap-2 mb-6">
                      <ShoppingCart className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
                      <h3 className="font-bold text-lg">Your Cart</h3>
                    </div>
                    {cart.length === 0 ? (
                      <div className="text-center py-12 opacity-60">
                        <p>Your cart is empty.</p>
                        <button onClick={() => setStep(1)} className="mt-3 text-sm font-medium" style={{ color: "var(--color-primary)" }}>Add a registration</button>
                      </div>
                    ) : (
                      <>
                        {cart.map((entry, idx) => (
                          <div key={idx} className="p-5 mb-3 flex items-start justify-between" style={{ border: "1px solid var(--color-table-border)" }}>
                            <div>
                              <p className="font-semibold">{entry.programName}</p>
                              <p className="text-sm opacity-70 mt-1">{entry.participants.map((p) => p.fullName).join(", ")}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                              <span className="font-bold" style={{ color: "var(--color-primary)" }}>{currency} ${entry.fee}</span>
                              <button onClick={() => editCartEntry(idx)} className="p-1.5 opacity-50 hover:opacity-100" title="Edit"><Edit2 className="h-4 w-4" /></button>
                              <button onClick={() => removeCartEntry(idx)} className="p-1.5 opacity-50 hover:opacity-100" title="Remove"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between py-5" style={{ borderTop: "1px solid var(--color-table-border)" }}>
                          <span className="font-bold text-lg">Total</span>
                          <span className="font-bold text-xl" style={{ color: "var(--color-primary)" }}>{currency} ${totalPrice}</span>
                        </div>
                        <div className="p-5 mb-5" style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}>
                          <label className="flex items-start gap-3 cursor-pointer text-sm leading-relaxed">
                            <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} className="mt-0.5 flex-shrink-0" />
                            <span style={{ color: "var(--color-body-text)" }}>{config.consentText}</span>
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button onClick={() => setStep(1)} className="btn-outline px-6 py-2.5 text-sm font-medium">Add More</button>
                          <button disabled={!consentChecked} onClick={() => navigate("/payment/result?status=success")}
                            className="btn-primary px-8 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                            {cart.some(e => {
                              const prog = event?.programs.find(p => p.id === e.programId);
                              return prog?.paymentRequired && e.fee > 0;
                            }) ? "Proceed to Payment" : "Confirm Registration"}
                          </button>
                        </div>
                        {isAuthenticated && <p className="text-xs mt-3 opacity-60">Payment can be collected or waived by admin later.</p>}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Admin Override Modal */}
      <Dialog open={overrideOpen} onOpenChange={(v) => { if (!v) { setOverrideOpen(false); setOverrideReason(""); } }}>
        <DialogContent className="max-w-md p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
          <DialogHeader className="p-8 pb-0"><DialogTitle className="font-bold text-xl">Override Validation</DialogTitle></DialogHeader>
          <div className="p-8 pt-4 space-y-4">
            <p className="text-sm opacity-70">You are about to bypass validation as an admin. This action will be audit logged.</p>
            <div>
              <label className="block text-xs font-semibold mb-2 opacity-70">Reason for override <span className="opacity-50">(min 10 characters)</span></label>
              <textarea className="field-input" rows={3} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Enter reason..." />
              <p className="text-xs mt-1 opacity-40">{overrideReason.trim().length} / 10 min</p>
            </div>
          </div>
          <DialogFooter className="p-8 pt-0">
            <button onClick={() => { setOverrideOpen(false); setOverrideReason(""); }} className="btn-outline px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button onClick={handleOverride} disabled={overrideReason.trim().length < 10}
              className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Confirm Override</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 mt-0.5 opacity-60" style={{ color: "var(--color-primary)" }} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-50">{label}</p>
        <p className="text-sm mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-2 opacity-70">{label}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: "var(--badge-open-text)" }}>{error}</p>}
    </div>
  );
}
