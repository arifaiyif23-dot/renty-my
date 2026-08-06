import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { TrustBadge } from "@/components/marketplace/TrustBadge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { VerificationLevel } from "@/types";
import { UserTrustBadge } from "@/components/trust/UserTrustBadge";
import { Clock, ChevronRight } from "lucide-react";
import { StarRating } from "@/components/StarRating";

interface VendorCardProps {
  name: string;
  avatar?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  verificationLevel?: VerificationLevel;
  responseTime?: string;
  trustScore?: number;
  vendorTrustScore?: number;
  onClick?: () => void;
  className?: string;
}

const VendorCard = ({
  name,
  avatar,
  location,
  rating = 0,
  reviewCount = 0,
  verificationLevel,
  responseTime,
  trustScore,
  vendorTrustScore,
  onClick,
  className,
}: VendorCardProps) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <GlassCard
        variant="interactive"
        padding="md"
        className={cn("flex items-center gap-4", className)}
      >
        <Avatar className="h-14 w-14 shrink-0 rounded-2xl border-2 border-border/80">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-semibold text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm truncate">{name}</p>
            {verificationLevel && verificationLevel !== "unverified" && (
              <TrustBadge kind="verified" size="sm" />
            )}
          </div>

          {location && (
            <p className="text-xs text-muted-foreground truncate mb-1.5">
              {location}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {rating > 0 && (
              <StarRating rating={rating} reviewCount={reviewCount} />
            )}
            {responseTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {responseTime}
              </span>
            )}
            {trustScore !== undefined && (
              <UserTrustBadge
                level={verificationLevel || "unverified"}
                trustScore={trustScore}
                vendorTrustScore={vendorTrustScore}
                size="sm"
              />
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
      </GlassCard>
    </button>
  );
};

export { VendorCard, type VendorCardProps };
