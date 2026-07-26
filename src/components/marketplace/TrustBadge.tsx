import { cn } from "@/lib/utils";
import { ShieldCheck, MapPin, BadgeCheck, Star } from "lucide-react";

type BadgeKind = "dijamin" | "lokal" | "verified" | "top-rated";
type BadgeSize = "sm" | "md" | "lg";

interface TrustBadgeProps {
  kind: BadgeKind;
  size?: BadgeSize;
  className?: string;
}

const BADGE_CONFIG: Record<BadgeKind, {
  label: string;
  icon: typeof ShieldCheck;
  description: string;
  base: string;
}> = {
  dijamin: {
    label: "Dijamin",
    icon: ShieldCheck,
    description: "Verified & guaranteed",
    base: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  lokal: {
    label: "Lokal Malaysia",
    icon: MapPin,
    description: "Local Malaysian owner",
    base: "bg-blue-50 text-blue-700 border-blue-200",
  },
  verified: {
    label: "Verified",
    icon: BadgeCheck,
    description: "Identity verified",
    base: "bg-primary/10 text-primary border-primary/20",
  },
  "top-rated": {
    label: "Top Rated",
    icon: Star,
    description: "Highly rated by renters",
    base: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[10px] gap-1 px-1.5 py-0.5",
  md: "text-xs gap-1.5 px-2.5 py-1",
  lg: "text-sm gap-2 px-3 py-1.5",
};

const iconSizes: Record<BadgeSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

const TrustBadge = ({ kind, size = "md", className }: TrustBadgeProps) => {
  const config = BADGE_CONFIG[kind];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.base,
        sizeStyles[size],
        className
      )}
      title={config.description}
    >
      <Icon className={cn("shrink-0", iconSizes[size])} />
      <span>{config.label}</span>
    </span>
  );
};

export { TrustBadge, type TrustBadgeProps, type BadgeKind };
