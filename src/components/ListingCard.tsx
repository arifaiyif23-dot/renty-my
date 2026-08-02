import { memo, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Heart, MapPin, Clock, BadgeCheck } from "lucide-react";
import { TrustBadge, type BadgeKind } from "@/components/marketplace/TrustBadge";
import { StarRating } from "@/components/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  verificationLevel?: string;
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
        "group block rounded-2xl overflow-hidden glass-elevated transition-all duration-300 hover:-translate-y-1 hover:shadow-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
              <div className="w-10 h-10 rounded-full bg-muted mx-auto mb-1" />
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

        {verificationLevel && verificationLevel !== 'unverified' && (
          <div className="absolute top-3 left-3">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm text-[11px] font-medium text-success shadow-1">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </div>
          </div>
        )}

        {mergedBadges && mergedBadges.length > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            {mergedBadges.map((badgeKind) => (
              <TrustBadge key={badgeKind} kind={badgeKind} size="sm" />
            ))}
          </div>
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
          className="absolute top-3 right-3 min-w-[36px] min-h-[36px] rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-all duration-200 active:scale-90 shadow-1"
          aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all duration-200",
              saved
                ? "fill-destructive text-destructive"
                : "text-foreground/60"
            )}
          />
        </button>

        {pricePerDay > 0 && (
          <div className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-1">
            <span className="font-bold text-sm tabular-nums">RM{pricePerDay}</span>
            <span className="text-xs text-muted-foreground">/day</span>
          </div>
        )}
      </div>

      <div className="p-3.5 sm:p-4">
        <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-1 mb-2">
          {title}
        </h3>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          {rating > 0 && (
            <StarRating rating={rating} reviewCount={reviewCount} />
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-success" />
            Available
          </span>
        </div>

        {location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{location}</span>
            {distance !== undefined && (
              <span className="tabular-nums shrink-0">· {distance} km</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
});

export { ListingCard, type ListingCardProps };
