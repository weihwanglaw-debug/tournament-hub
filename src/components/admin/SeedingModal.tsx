import { useState } from "react";
import { Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SeedingModalProps {
  open: boolean;
  onClose: () => void;
  programId: string;
}

export default function SeedingModal({ open, onClose, programId }: SeedingModalProps) {
  const [mode, setMode] = useState<"import" | "manual">("import");
  const [finalized, setFinalized] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0" style={{ backgroundColor: "var(--color-page-bg)", border: "1px solid var(--color-table-border)" }}>
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="font-heading font-bold text-xl">Seeding Configuration</DialogTitle>
        </DialogHeader>

        <div className="p-8 pt-6">
          {/* Mode tabs */}
          <div className="flex gap-2 mb-8">
            {(["import", "manual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-4 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: mode === m ? "var(--color-primary)" : "transparent",
                  color: mode === m ? "var(--color-hero-text)" : "var(--color-body-text)",
                  border: `1px solid ${mode === m ? "var(--color-primary)" : "var(--color-table-border)"}`,
                }}
              >
                {m === "import" ? "File Import" : "Manual Entry"}
              </button>
            ))}
          </div>

          {mode === "import" ? (
            <div className="space-y-5">
              <button className="btn-outline flex items-center gap-2 px-4 py-2.5 text-sm font-medium w-full justify-center">
                <Download className="h-4 w-4" /> Download Blank Template
              </button>
              <div>
                <label className="block text-xs font-semibold mb-2 opacity-70">Upload Completed File</label>
                <input type="file" accept=".xlsx,.csv" className="field-input" />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm opacity-60 mb-5">
                Enter seeding rank for each registered participant. Participants will be listed once registration data is available.
              </p>
              <div className="text-center py-8 opacity-40 text-sm">
                No participants registered yet.
              </div>
            </div>
          )}

          <div className="mt-8 pt-5" style={{ borderTop: "1px solid var(--color-table-border)" }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={finalized} onChange={(e) => setFinalized(e.target.checked)} />
              <span>Finalize seeding (required before fixture generation)</span>
            </label>
          </div>
        </div>

        <DialogFooter className="p-8 pt-0">
          <button onClick={onClose} className="btn-outline px-5 py-2.5 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={onClose}
            disabled={!finalized}
            className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Seeding
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
