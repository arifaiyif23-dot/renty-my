import { memo, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Heart, MapPin, BadgeCheck } from "lucide-react";
import { TrustBadge, type BadgeKind } from "@/components/marketplace/TrustBadge";
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
        "group block rounded-xl overflow-hidden bg-card border border-border/40 transition-all duration-200 hover:shadow-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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
          <div className="absolute top-2 left-2">
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-card/90 text-[10px] font-medium text-success">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </div>
          </div>
        )}

        {mergedBadges && mergedBadges.length > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
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
          className="absolute top-2 right-2 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-card/90 flex items-center justify-center hover:bg-card transition-all duration-200 active:scale-90"
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
      </div>

      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 className="font-semibold text-xs leading-snug line-clamp-1">{title}</h3>
          {pricePerDay > 0 && (
            <span className="text-xs font-bold tabular-nums whitespace-nowrap">RM{pricePerDay}<span className="font-normal text-muted-foreground">/day</span></span>
          )}
        </div>

        {rating > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-0.5">
            <span className="text-foreground font-medium">{rating.toFixed(1)}</span>
            <span>({reviewCount})</span>
          </div>
        )}

        {location && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
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
