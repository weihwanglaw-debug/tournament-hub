import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import config from "@/data/config.json";

interface ConsentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConsentModal({ open, onClose, onConfirm }: ConsentModalProps) {
  const [agreed, setAgreed] = useState(false);

  const handleConfirm = () => {
    if (agreed) {
      onConfirm();
      setAgreed(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setAgreed(false); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Consent & Acknowledgment</DialogTitle>
        </DialogHeader>
        <div className="py-4 text-sm leading-relaxed" style={{ color: "var(--color-body-text)" }}>
          {config.consentText}
        </div>
        <div className="flex items-start gap-3 py-2">
          <Checkbox
            id="consent"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
          />
          <label htmlFor="consent" className="text-sm cursor-pointer leading-tight">
            I have read and agree to the above terms and conditions.
          </label>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: "var(--color-body-text)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!agreed}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm & Add to Cart
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
