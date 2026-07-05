import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type StampVariant =
  | "verified"
  | "pending"
  | "confirmed"
  | "rejected"
  | "founding-vendor"
  | "draft";

interface StatusStampProps {
  variant?: StampVariant;
  label?: string;
  className?: string;
  /** kept for backwards compatibility; no longer applies rotation */
  rotate?: boolean;
}

const VARIANTS: Record<StampVariant, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" | "soft" }> = {
  verified:          { label: "Verified",         variant: "success" },
  pending:           { label: "Pending",          variant: "warning" },
  confirmed:         { label: "Confirmed",        variant: "success" },
  rejected:          { label: "Rejected",         variant: "destructive" },
  "founding-vendor": { label: "Founding Vendor",  variant: "default" },
  draft:             { label: "Draft",            variant: "outline" },
};

/**
 * Trust pill — v2 spec: minimal badge, no decorative fonts, no rotation.
 * Kept as a shim so existing call sites don't break.
 */
export function StatusStamp({ variant = "verified", label, className }: StatusStampProps) {
  const v = VARIANTS[variant];
  return (
    <Badge variant={v.variant} className={cn("font-medium", className)} aria-label={label ?? v.label}>
      {label ?? v.label}
    </Badge>
  );
}

export default StatusStamp;
