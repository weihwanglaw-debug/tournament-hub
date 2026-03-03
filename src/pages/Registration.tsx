import { useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Plus, Trash2, AlertCircle, ArrowLeft } from "lucide-react";
import config from "@/data/config.json";
import type { TournamentEvent, Program, Participant, CartEntry } from "@/types/config";
import { getEventStatus, formatDate } from "@/lib/eventUtils";
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

export default function Registration() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const event = config.events.find((e) => e.id === id) as TournamentEvent | undefined;

  const [step, setStep] = useState(1);
  const [selectedProgramId, setSelectedProgramId] = useState(params.get("program") || "");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingParticipants, setPendingParticipants] = useState<Participant[]>([]);

  const selectedProgram = event?.programs.find((p) => p.id === selectedProgramId);

  // Build blank participant
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
    customFieldValues: {},
  });

  // Initialize participants when program selected
  const handleSelectProgram = (pid: string) => {
    setSelectedProgramId(pid);
    const prog = event?.programs.find((p) => p.id === pid);
    if (prog) {
      const initial = Array.from({ length: prog.minPlayers }, () => blankParticipant());
      setParticipants(initial);
    }
    setErrors({});
    setFormError("");
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

  // Validate
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

      // Age check
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

      // Guardian
      if (selectedProgram.fields.enableGuardianInfo) {
        if (!p.guardianName?.trim()) errs[`${prefix}.guardianName`] = "Required";
        if (!p.guardianContact?.trim()) errs[`${prefix}.guardianContact`] = "Required";
      }

      // Custom fields
      selectedProgram.fields.customFields.forEach((cf) => {
        if (cf.required && !p.customFieldValues[cf.label]?.trim()) {
          errs[`${prefix}.custom.${cf.label}`] = "Required";
        }
      });

      // Duplicate check in cart
      const dupe = cart.some((entry) =>
        entry.programId === selectedProgram.id &&
        entry.participants.some(
          (ep) => ep.fullName === p.fullName && ep.dobDay === p.dobDay && ep.dobMonth === p.dobMonth && ep.dobYear === p.dobYear
        )
      );
      if (dupe) errs[`${prefix}.fullName`] = "Already registered in this program";
    });

    // Mixed doubles check
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
          <p className="font-heading text-xl">Event not found</p>
        </div>
        <Footer />
      </div>
    );
  }

  const status = getEventStatus(event);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-12 px-6" style={{ backgroundColor: "var(--color-page-bg)" }}>
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(`/event/${event.id}`)}
            className="flex items-center gap-1 text-sm mb-6 opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: "var(--color-primary)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Back to {event.name}
          </button>

          <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2">Registration</h1>
          <p className="text-sm mb-8 opacity-70">{event.name}</p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    backgroundColor: step >= s ? "var(--color-primary)" : "var(--color-table-border)",
                    color: step >= s ? "#fff" : "var(--color-body-text)",
                  }}
                >
                  {s}
                </div>
                <span className="text-sm font-medium hidden sm:inline">
                  {s === 1 ? "Program" : s === 2 ? "Participants" : "Cart"}
                </span>
                {s < 3 && <div className="w-8 h-px" style={{ backgroundColor: "var(--color-table-border)" }} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 1 — Program Selection */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="font-heading font-bold text-lg mb-4">Select a Program</h2>
                <div className="grid gap-3">
                  {event.programs.map((prog) => (
                    <button
                      key={prog.id}
                      disabled={status !== "open"}
                      onClick={() => handleSelectProgram(prog.id)}
                      className="text-left p-4 rounded-xl transition-all disabled:opacity-40"
                      style={{
                        border: `2px solid ${selectedProgramId === prog.id ? "var(--color-primary)" : "var(--color-table-border)"}`,
                        backgroundColor: selectedProgramId === prog.id ? "var(--color-row-hover)" : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{prog.name}</span>
                        <span className="font-bold" style={{ color: "var(--color-primary)" }}>${prog.fee}</span>
                      </div>
                      <p className="text-xs mt-1 opacity-60">
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-bold text-lg">
                    {selectedProgram.name} — Participant Details
                  </h2>
                  <button onClick={() => setStep(1)} className="text-sm" style={{ color: "var(--color-primary)" }}>
                    Change Program
                  </button>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm" style={{ backgroundColor: "var(--badge-open-bg)", color: "var(--badge-open-text)" }}>
                    <AlertCircle className="h-4 w-4" /> {formError}
                  </div>
                )}

                {participants.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-5 rounded-xl mb-4"
                    style={{ border: "1px solid var(--color-table-border)", backgroundColor: "var(--color-row-hover)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-heading font-semibold text-sm">Player {idx + 1}</h3>
                      {participants.length > selectedProgram.minPlayers && (
                        <button onClick={() => removeParticipant(idx)} className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100">
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Full Name (as per NRIC/Passport)" error={errors[`p${idx}.fullName`]}>
                        <input
                          className="field-input"
                          value={p.fullName}
                          onChange={(e) => updateParticipant(idx, "fullName", e.target.value)}
                        />
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
                    className="flex items-center gap-2 text-sm font-medium mb-6"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Plus className="h-4 w-4" /> Add Player
                  </button>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-lg text-sm font-medium border" style={{ borderColor: "var(--color-table-border)" }}>
                    Back
                  </button>
                  <button onClick={handleAddToCart} className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold">
                    Add to Cart
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Cart */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
                  <h2 className="font-heading font-bold text-lg">Your Cart</h2>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-10 opacity-60">
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
                        className="p-4 rounded-xl mb-3 flex items-start justify-between"
                        style={{ border: "1px solid var(--color-table-border)" }}
                      >
                        <div>
                          <p className="font-semibold">{entry.programName}</p>
                          <p className="text-sm opacity-70">
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

                    <div className="flex items-center justify-between py-4 border-t mt-4" style={{ borderColor: "var(--color-table-border)" }}>
                      <span className="font-heading font-bold text-lg">Total</span>
                      <span className="font-heading font-bold text-xl" style={{ color: "var(--color-primary)" }}>
                        {currency} ${totalPrice}
                      </span>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-lg text-sm font-medium border" style={{ borderColor: "var(--color-table-border)" }}>
                        Add More
                      </button>
                      <button
                        onClick={() => {
                          if (isAuthenticated) {
                            navigate("/payment/result?status=success");
                          } else {
                            navigate("/payment/result?status=success");
                          }
                        }}
                        className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold"
                      >
                        {isAuthenticated ? "Confirm Registration" : "Proceed to Payment"}
                      </button>
                    </div>
                    {isAuthenticated && (
                      <p className="text-xs mt-2 opacity-60">
                        Payment can be collected or waived by admin later.
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 opacity-70">{label}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: "var(--badge-open-text)" }}>{error}</p>}
    </div>
  );
}
