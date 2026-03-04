import { useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Users, Download, ArrowLeft, ShoppingCart, Plus, Trash2, AlertCircle } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent, Program, Participant, CartEntry } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
import StatusBadge from "@/components/events/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import ConsentModal from "@/components/registration/ConsentModal";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 80 }, (_, i) => String(currentYear - i));

export default function EventDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const event = config.events.find((e) => e.id === id) as TournamentEvent | undefined;

  // Registration state
  const [registering, setRegistering] = useState(!!params.get("program"));
  const [step, setStep] = useState(params.get("program") ? 2 : 1);
  const [selectedProgramId, setSelectedProgramId] = useState(params.get("program") || "");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingParticipants, setPendingParticipants] = useState<Participant[]>([]);

  const selectedProgram = event?.programs.find((p) => p.id === selectedProgramId);

  const blankParticipant = (): Participant => ({
    id: generateId(),
    fullName: "",
    dobDay: "",
    dobMonth: "",
    dobYear: "",
    gender: "",
    email: "",
    contactNumber: "",
    nationality: "",
    sbaId: "",
    guardianName: "",
    guardianContact: "",
    documentFile: null,
    remark: "",
    customFieldValues: {},
  });

  const handleSelectProgram = (pid: string) => {
    setSelectedProgramId(pid);
    const prog = event?.programs.find((p) => p.id === pid);
    if (prog) {
      const initial = Array.from({ length: prog.minPlayers }, () => blankParticipant());
      setParticipants(initial);
    }
    setErrors({});
    setFormError("");
    setRegistering(true);
    setStep(2);
  };

  const updateParticipant = (idx: number, field: string, value: string) => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const updateCustomField = (idx: number, label: string, value: string) => {
    setParticipants((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, customFieldValues: { ...p.customFieldValues, [label]: value } } : p
      )
    );
  };

  const addParticipant = () => {
    if (!selectedProgram) return;
    if (participants.length >= selectedProgram.maxPlayers) return;
    setParticipants((prev) => [...prev, blankParticipant()]);
  };

  const removeParticipant = (idx: number) => {
    if (!selectedProgram) return;
    if (participants.length <= selectedProgram.minPlayers) return;
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): boolean => {
    if (!selectedProgram) return false;
    const errs: Record<string, string> = {};
    let formErr = "";

    participants.forEach((p, i) => {
      const prefix = `p${i}`;
      if (!p.fullName.trim()) errs[`${prefix}.fullName`] = "Required";
      if (!p.dobDay || !p.dobMonth || !p.dobYear) errs[`${prefix}.dob`] = "Complete date required";
      if (!p.gender) errs[`${prefix}.gender`] = "Required";
      if (!p.email.trim()) errs[`${prefix}.email`] = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errs[`${prefix}.email`] = "Invalid email";
      if (!p.contactNumber.trim()) errs[`${prefix}.contactNumber`] = "Required";
      if (!p.nationality.trim()) errs[`${prefix}.nationality`] = "Required";

      if (p.dobDay && p.dobMonth && p.dobYear) {
        const monthIdx = months.indexOf(p.dobMonth);
        const dob = new Date(+p.dobYear, monthIdx, +p.dobDay);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const mDiff = today.getMonth() - dob.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
        if (age < selectedProgram.minAge || age > selectedProgram.maxAge) {
          errs[`${prefix}.dob`] = `Age must be ${selectedProgram.minAge}–${selectedProgram.maxAge}`;
        }
      }

      if (selectedProgram.fields.enableGuardianInfo) {
        if (!p.guardianName?.trim()) errs[`${prefix}.guardianName`] = "Required";
        if (!p.guardianContact?.trim()) errs[`${prefix}.guardianContact`] = "Required";
      }

      selectedProgram.fields.customFields.forEach((cf) => {
        if (cf.required && !p.customFieldValues[cf.label]?.trim()) {
          errs[`${prefix}.custom.${cf.label}`] = "Required";
        }
      });

      const dupe = cart.some((entry) =>
        entry.programId === selectedProgram.id &&
        entry.participants.some(
          (ep) => ep.fullName === p.fullName && ep.dobDay === p.dobDay && ep.dobMonth === p.dobMonth && ep.dobYear === p.dobYear
        )
      );
      if (dupe) errs[`${prefix}.fullName`] = "Already registered in this program";
    });

    if (selectedProgram.gender === "Mixed" && selectedProgram.maxPlayers === 2 && participants.length === 2) {
      const genders = participants.map((p) => p.gender);
      if (!(genders.includes("Male") && genders.includes("Female"))) {
        formErr = "Mixed Doubles requires exactly 1 Male and 1 Female player.";
      }
    }

    setErrors(errs);
    setFormError(formErr);
    return Object.keys(errs).length === 0 && !formErr;
  };

  const handleAddToCart = () => {
    if (!validate()) return;
    setPendingParticipants([...participants]);
    setConsentOpen(true);
  };

  const confirmAddToCart = () => {
    if (!selectedProgram) return;
    setCart((prev) => [
      ...prev,
      {
        programId: selectedProgram.id,
        programName: selectedProgram.name,
        fee: selectedProgram.fee,
        participants: pendingParticipants,
      },
    ]);
    setConsentOpen(false);
    setPendingParticipants([]);
    setParticipants([blankParticipant()]);
    setSelectedProgramId("");
    setStep(3);
  };

  const removeCartEntry = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalPrice = cart.reduce((sum, e) => sum + e.fee, 0);
  const currency = config.payment.currency || "SGD";

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold mb-4">Event Not Found</h1>
            <button onClick={() => navigate("/")} className="btn-primary px-5 py-2.5 text-sm">
              Back to Home
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const status = getEventStatus(event);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-16" style={{ backgroundColor: "var(--color-page-bg)" }}>
        {/* Hero banner */}
        <div
          className="py-14 px-8"
          style={{ background: "var(--color-hero-bg)", color: "var(--color-hero-text)" }}
        >
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-sm mb-5 opacity-70 hover:opacity-100 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" /> Back to events
            </button>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start gap-3 mb-3">
                <h1 className="font-heading font-bold text-3xl md:text-4xl" style={{ color: "var(--color-hero-text)" }}>
                  {event.name}
                </h1>
                <StatusBadge status={status} />
              </div>
              <p className="opacity-80 max-w-2xl text-base">{event.description}</p>
            </motion.div>
          </div>
        </div>

        {/* Event info */}
        <div className="max-w-5xl mx-auto py-12 px-8">
          <div className="grid md:grid-cols-2 gap-10 mb-12">
            <div className="space-y-5">
              <InfoRow icon={Calendar} label="Event Dates" value={`${formatDate(event.eventStartDate)} – ${formatDate(event.eventEndDate)}`} />
              <InfoRow icon={MapPin} label="Venue" value={`${event.venue}, ${event.venueAddress}`} />
              <InfoRow icon={Users} label="Max Participants" value={String(event.maxParticipants)} />
              <InfoRow icon={Calendar} label="Registration Period" value={`${formatDate(event.openDate)} – ${formatDate(event.closeDate)}`} />
              {event.sponsorInfo && (
                <p className="text-sm opacity-70 italic">{event.sponsorInfo}</p>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {event.prospectusUrl && (
                <a
                  href={event.prospectusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-semibold text-sm w-fit"
                >
                  <Download className="h-4 w-4" /> Download Prospectus
                </a>
              )}
              {status === "upcoming" && (
                <div className="p-5 text-sm" style={{ backgroundColor: "var(--badge-soon-bg)", color: "var(--badge-soon-text)" }}>
                  Registration opens on {formatDate(event.openDate)}
                </div>
              )}
              {status === "closed" && (
                <div className="p-5 text-sm" style={{ backgroundColor: "var(--badge-closed-bg)", color: "var(--badge-closed-text)" }}>
                  Registration Closed
                </div>
              )}
            </div>
          </div>

          {/* Programs table */}
          <h2 className="font-heading font-bold text-xl mb-6">Programs</h2>
          <div className="overflow-x-auto" style={{ border: "1px solid var(--color-table-border)" }}>
            <table className="trs-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Type</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th className="text-right">Fee</th>
                  <th className="text-center">Players</th>
                  <th className="text-center">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {event.programs.map((prog) => (
                  <tr key={prog.id}>
                    <td className="font-medium">{prog.name}</td>
                    <td>{prog.type}</td>
                    <td>{prog.minAge}–{prog.maxAge}</td>
                    <td>{prog.gender}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--color-primary)" }}>
                      ${prog.fee}
                    </td>
                    <td className="text-center">
                      {prog.minPlayers === prog.maxPlayers ? prog.maxPlayers : `${prog.minPlayers}–${prog.maxPlayers}`}
                    </td>
                    <td className="text-center">
                      <StatusBadge status={status} />
                    </td>
                    <td>
                      <button
                        disabled={status !== "open"}
                        onClick={() => handleSelectProgram(prog.id)}
                        className="btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Register
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Registration Section */}
          {registering && status === "open" && (
            <div className="mt-16 section-anchor" id="registration">
              <div className="h-px mb-12" style={{ backgroundColor: "var(--color-table-border)" }} />
              <h2 className="font-heading font-bold text-2xl mb-8">Registration</h2>

              {/* Step indicator */}
              <div className="flex items-center gap-3 mb-10">
                {[
                  { n: 1, label: "Program" },
                  { n: 2, label: "Participants" },
                  { n: 3, label: "Cart" },
                ].map((s) => (
                  <div key={s.n} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: step >= s.n ? "var(--color-primary)" : "var(--color-table-border)",
                        color: step >= s.n ? "var(--color-hero-text)" : "var(--color-body-text)",
                      }}
                    >
                      {s.n}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                    {s.n < 3 && <div className="w-10 h-px" style={{ backgroundColor: "var(--color-table-border)" }} />}
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* STEP 1 — Program Selection */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <h3 className="font-heading font-bold text-lg mb-5">Select a Program</h3>
                    <div className="grid gap-4">
                      {event.programs.map((prog) => (
                        <button
                          key={prog.id}
                          disabled={status !== "open"}
                          onClick={() => handleSelectProgram(prog.id)}
                          className="text-left p-5 transition-all disabled:opacity-40"
                          style={{
                            border: `2px solid ${selectedProgramId === prog.id ? "var(--color-primary)" : "var(--color-table-border)"}`,
                            backgroundColor: selectedProgramId === prog.id ? "var(--color-row-hover)" : "transparent",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{prog.name}</span>
                            <span className="font-bold" style={{ color: "var(--color-primary)" }}>${prog.fee}</span>
                          </div>
                          <p className="text-xs mt-2 opacity-60">
                            {prog.type} · {prog.gender} · Ages {prog.minAge}–{prog.maxAge} · {prog.minPlayers === prog.maxPlayers ? prog.maxPlayers : `${prog.minPlayers}–${prog.maxPlayers}`} player(s)
                          </p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* STEP 2 — Participant Form */}
                {step === 2 && selectedProgram && (
                  <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-heading font-bold text-lg">
                        {selectedProgram.name} — Participant Details
                      </h3>
                      <button onClick={() => setStep(1)} className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                        Change Program
                      </button>
                    </div>

                    {formError && (
                      <div className="flex items-center gap-2 p-4 mb-5 text-sm" style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                        <AlertCircle className="h-4 w-4" /> {formError}
                      </div>
                    )}

                    {participants.map((p, idx) => (
                      <div
                        key={p.id}
                        className="p-6 mb-5"
                        style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-heading font-semibold text-sm">Player {idx + 1}</h4>
                          {participants.length > selectedProgram.minPlayers && (
                            <button onClick={() => removeParticipant(idx)} className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100">
                              <Trash2 className="h-3 w-3" /> Remove
                            </button>
                          )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                          <Field label="Full Name (as per NRIC/Passport)" error={errors[`p${idx}.fullName`]}>
                            <input className="field-input" value={p.fullName} onChange={(e) => updateParticipant(idx, "fullName", e.target.value)} />
                          </Field>

                          <Field label="Date of Birth" error={errors[`p${idx}.dob`]}>
                            <div className="flex gap-2">
                              <select className="field-input flex-1" value={p.dobDay} onChange={(e) => updateParticipant(idx, "dobDay", e.target.value)}>
                                <option value="">Day</option>
                                {days.map((d) => <option key={d} value={d}>{d}</option>)}
                              </select>
                              <select className="field-input flex-1" value={p.dobMonth} onChange={(e) => updateParticipant(idx, "dobMonth", e.target.value)}>
                                <option value="">Month</option>
                                {months.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <select className="field-input flex-1" value={p.dobYear} onChange={(e) => updateParticipant(idx, "dobYear", e.target.value)}>
                                <option value="">Year</option>
                                {years.map((y) => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                          </Field>

                          <Field label="Gender" error={errors[`p${idx}.gender`]}>
                            <select className="field-input" value={p.gender} onChange={(e) => updateParticipant(idx, "gender", e.target.value)}>
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
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

                          {selectedProgram.fields.enableSbaId && (
                            <Field label="SBA ID">
                              <input className="field-input" value={p.sbaId || ""} onChange={(e) => updateParticipant(idx, "sbaId", e.target.value)} placeholder="Enter SBA ID" />
                            </Field>
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

                          {selectedProgram.fields.customFields.map((cf) => (
                            <Field key={cf.label} label={cf.label} error={errors[`p${idx}.custom.${cf.label}`]}>
                              <input
                                className="field-input"
                                value={p.customFieldValues[cf.label] || ""}
                                onChange={(e) => updateCustomField(idx, cf.label, e.target.value)}
                              />
                            </Field>
                          ))}

                          {selectedProgram.fields.enableDocumentUpload && (
                            <Field label="Document Upload (PDF/JPG/PNG)">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="field-input"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setParticipants((prev) => prev.map((pp, i) => i === idx ? { ...pp, documentFile: file } : pp));
                                }}
                              />
                            </Field>
                          )}
                        </div>
                      </div>
                    ))}

                    {participants.length < selectedProgram.maxPlayers && (
                      <button
                        onClick={addParticipant}
                        className="flex items-center gap-2 text-sm font-medium mb-8"
                        style={{ color: "var(--color-primary)" }}
                      >
                        <Plus className="h-4 w-4" /> Add Player
                      </button>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => { setStep(1); setRegistering(false); }} className="btn-outline px-6 py-2.5 text-sm font-medium">
                        Back
                      </button>
                      <button onClick={handleAddToCart} className="btn-primary px-6 py-2.5 text-sm font-semibold">
                        Add to Cart
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3 — Cart */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <div className="flex items-center gap-2 mb-6">
                      <ShoppingCart className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
                      <h3 className="font-heading font-bold text-lg">Your Cart</h3>
                    </div>

                    {cart.length === 0 ? (
                      <div className="text-center py-12 opacity-60">
                        <p>Your cart is empty.</p>
                        <button onClick={() => setStep(1)} className="mt-3 text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                          Add a registration
                        </button>
                      </div>
                    ) : (
                      <>
                        {cart.map((entry, idx) => (
                          <div
                            key={idx}
                            className="p-5 mb-3 flex items-start justify-between"
                            style={{ border: "1px solid var(--color-table-border)" }}
                          >
                            <div>
                              <p className="font-semibold">{entry.programName}</p>
                              <p className="text-sm opacity-70 mt-1">
                                {entry.participants.map((p) => p.fullName).join(", ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold" style={{ color: "var(--color-primary)" }}>
                                {currency} ${entry.fee}
                              </span>
                              <button onClick={() => removeCartEntry(idx)} className="opacity-50 hover:opacity-100">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center justify-between py-5 border-t mt-5" style={{ borderColor: "var(--color-table-border)" }}>
                          <span className="font-heading font-bold text-lg">Total</span>
                          <span className="font-heading font-bold text-xl" style={{ color: "var(--color-primary)" }}>
                            {currency} ${totalPrice}
                          </span>
                        </div>

                        <div className="flex gap-3 mt-5">
                          <button onClick={() => setStep(1)} className="btn-outline px-6 py-2.5 text-sm font-medium">
                            Add More
                          </button>
                          <button
                            onClick={() => navigate("/payment/result?status=success")}
                            className="btn-primary px-8 py-2.5 text-sm font-semibold"
                          >
                            {isAuthenticated ? "Confirm Registration" : "Proceed to Payment"}
                          </button>
                        </div>
                        {isAuthenticated && (
                          <p className="text-xs mt-3 opacity-60">
                            Payment can be collected or waived by admin later.
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <ConsentModal
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        onConfirm={confirmAddToCart}
      />
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
