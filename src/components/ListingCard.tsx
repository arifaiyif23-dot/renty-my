import { memo, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Heart, Star, MapPin, Share2 } from "lucide-react";
import { UserTrustBadge } from "@/components/trust/UserTrustBadge";
import { TrustBadge, type BadgeKind } from "@/components/marketplace/TrustBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isNative } from "@/lib/platform";
import type { VerificationLevel } from "@/types";

interface ListingCardProps {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  distance?: number;
  verificationLevel?: VerificationLevel;
  badge?: "trending" | "just-listed" | "available";
  badges?: BadgeKind[];
  className?: string;
  initialSaved?: boolean;
}

const ListingCard = memo(({
  id,
  title,
  image,
  pricePerDay,
  category,
  location,
  rating = 0,
  reviewCount = 0,
  distance,
  verificationLevel,
  badge,
  badges,
  className,
  initialSaved = false,
}: ListingCardProps) => {
  const { user } = useAuth();
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const mergedBadges = useMemo(() => {
    const result: BadgeKind[] = [...(badges || [])];
    if (badge === "trending") result.push("trending");
    if (badge === "just-listed") result.push("just-listed");
    if (badge === "available") result.push("available-now");
    return result.length > 0 ? result : undefined;
  }, [badge, badges]);

  return (
    <Link
      to={`/items/${id}`}
      className={cn(
        "group block rounded-xl overflow-hidden glass hover:glass-elevated transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="relative aspect-golden overflow-hidden bg-muted">
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 animate-shimmer" />
        )}
        {imgError ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-muted mx-auto mb-1" />
              <span className="text-xs">No image</span>
            </div>
          </div>
        ) : (
          <img
            src={image}
            alt={title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={cn(
              "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!user) { toast.error('Sign in to save items'); return; }
            if (saving) return;
            setSaving(true);
            try {
              if (saved) {
                await supabase.from('saved_items').delete().eq('user_id', user.id).eq('item_id', id);
                setSaved(false);
              } else {
                await supabase.from('saved_items').insert({ user_id: user.id, item_id: id });
                setSaved(true);
              }
            } catch { /* silent fail */ }
            setSaving(false);
          }}
          className="absolute top-2 right-11 sm:top-3 sm:right-14 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-200 active:scale-90"
          aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all duration-200",
              saved
                ? "fill-red-500 text-red-500"
                : "text-foreground/70"
            )}
          />
        </button>

        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const shareUrl = `${window.location.origin}/items/${id}`;
            const shareText = `Check out "${title}" on RENTY — RM${pricePerDay}/day`;
            if (isNative()) {
              try {
                const { Share } = await import('@capacitor/share');
                await Share.share({ title, text: shareText, url: shareUrl });
              } catch {
                navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied!');
              }
            } else if (navigator.share) {
              navigator.share({ title, text: shareText, url: shareUrl }).catch(() => {});
            } else {
              navigator.clipboard.writeText(shareUrl);
              toast.success('Link copied!');
            }
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-200 active:scale-90"
          aria-label="Share item"
        >
          <Share2 className="h-4 w-4 text-foreground/70" />
        </button>

        {mergedBadges && mergedBadges.length > 0 && (
          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1.5">
            {mergedBadges.map((badgeKind) => (
              <TrustBadge key={badgeKind} kind={badgeKind} size="sm" />
            ))}
          </div>
        )}

        {pricePerDay > 0 && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-white/70 backdrop-blur-sm rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-1">
            <span className="font-bold text-xs sm:text-sm lg:text-base tabular-nums">RM{pricePerDay}</span>
            <span className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">/day</span>
          </div>
        )}
      </div>

      <div className="p-2.5 sm:p-4 lg:p-5">
        <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base leading-snug line-clamp-2 flex-1">
            {title}
          </h3>
          {rating > 0 && (
            <span className="flex items-center gap-1 shrink-0 text-[10px] sm:text-xs lg:text-sm">
              <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="text-muted-foreground">({reviewCount})</span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
          {category && (
            <span className="bg-muted rounded-md px-1.5 py-0.5 sm:px-2 truncate max-w-[7rem] lg:max-w-[9rem]">{category}</span>
          )}
          {location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0" />
              {location}
              {distance !== undefined && (
                <span className="tabular-nums whitespace-nowrap shrink-0">· {distance} km</span>
              )}
            </span>
          )}
        </div>

        {verificationLevel && verificationLevel !== 'unverified' ? (
          <div className="mt-1.5 lg:mt-2">
            <UserTrustBadge level={verificationLevel} size="sm" />
          </div>
        ) : (
          <div className="mt-1.5 lg:mt-2 text-[10px] sm:text-xs text-muted-foreground">New</div>
        )}
      </div>
    </Link>
  );
});

export { ListingCard, type ListingCardProps };
