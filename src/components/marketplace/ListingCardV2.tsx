import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Heart, Star, MapPin, Share2 } from "lucide-react";
import { TrustBadge, type BadgeKind } from "@/components/marketplace/TrustBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ListingCardV2Props {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  badges?: BadgeKind[];
  className?: string;
  initialSaved?: boolean;
}

const ListingCardV2 = memo(({
  id,
  title,
  image,
  pricePerDay,
  category,
  location,
  rating = 0,
  reviewCount = 0,
  badges,
  className,
  initialSaved = false,
}: ListingCardV2Props) => {
  const { user } = useAuth();
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={`/items/${id}`}
      className={cn(
        "group block rounded-xl overflow-hidden bg-card border border-border shadow-1 hover:shadow-3 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          className="absolute top-3 right-14 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-200 active:scale-90"
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const shareUrl = `${window.location.origin}/items/${id}`;
            const shareText = `Check out "${title}" on RENTY — RM${pricePerDay}/day`;
            if (navigator.share) {
              navigator.share({ title, text: shareText, url: shareUrl }).catch(() => {});
            } else {
              navigator.clipboard.writeText(shareUrl);
              toast.success('Link copied!');
            }
          }}
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-200 active:scale-90"
          aria-label="Share item"
        >
          <Share2 className="h-4 w-4 text-foreground/70" />
        </button>

        {badges && badges.length > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            {badges.map((badge) => (
              <TrustBadge key={badge} kind={badge} size="sm" />
            ))}
          </div>
        )}

        {pricePerDay > 0 && (
          <div className="absolute top-3 left-3 bg-white/70 backdrop-blur-sm rounded-lg px-2.5 py-1">
            <span className="font-bold text-sm tabular-nums">RM{pricePerDay}</span>
            <span className="text-xs text-muted-foreground">/day</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">
            {title}
          </h3>
          {rating > 0 && (
            <span className="flex items-center gap-1 shrink-0 text-xs">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="text-muted-foreground">({reviewCount})</span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {category && (
            <span className="bg-muted rounded-md px-2 py-0.5">{category}</span>
          )}
          {location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {location}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

export { ListingCardV2, type ListingCardV2Props };
