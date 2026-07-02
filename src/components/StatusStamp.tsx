import { cn } from "@/lib/utils";

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
  rotate?: boolean;
}

const VARIANTS: Record<StampVariant, { label: string; color: string }> = {
  verified: { label: "Verified", color: "text-success border-success" },
  pending: { label: "Pending", color: "text-warning border-warning" },
  confirmed: { label: "Confirmed", color: "text-success border-success" },
  rejected: { label: "Rejected", color: "text-destructive border-destructive" },
  "founding-vendor": {
    label: "Founding Vendor",
    color: "text-primary border-primary",
  },
  draft: { label: "Draft", color: "text-muted-foreground border-muted-foreground" },
};

/**
 * Rubber-stamp / checkpoint mark visual — see BRAND_IDENTITY.md §5.
 * Dashed double border, JetBrains Mono uppercase, slight rotation.
 */
export function StatusStamp({
  variant = "verified",
  label,
  className,
  rotate = true,
}: StatusStampProps) {
  const v = VARIANTS[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-2 border-dashed px-2 py-0.5",
        "font-mono uppercase tracking-widest text-[10px] font-bold",
        "bg-background/40",
        rotate && "-rotate-3",
        v.color,
        className,
      )}
      aria-label={label ?? v.label}
    >
      {label ?? v.label}
    </span>
  );
}

export default StatusStamp;
