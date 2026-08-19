import { memo, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Heart, MapPin, BadgeCheck, Image as ImageIcon } from "lucide-react";
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
  verificationLevel,
  badge,
  badges,
  className,
  initialSaved = false,
}: ListingCardProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
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
  };

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
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 animate-shimmer" />
        )}
        {imgError ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-background/70 flex items-center justify-center mx-auto mb-1.5">
                <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <span className="text-xs">{t('listingCard.noImage')}</span>
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
              "w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        {mergedBadges && mergedBadges.length > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            {mergedBadges.map((badgeKind) => (
              <TrustBadge key={badgeKind} kind={badgeKind} size="sm" />
            ))}
          </div>
        )}

        <button
          onClick={handleWishlistToggle}
          className="absolute top-3 right-3 min-w-[36px] min-h-[36px] rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-all duration-200 active:scale-90"
          aria-label={saved ? t('listingCard.removeFromWishlist') : t('listingCard.addToWishlist')}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all duration-200",
              saved ? "fill-white text-white drop-shadow-sm" : "text-white/80"
            )}
          />
        </button>

        {/* Gradient overlay + info */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-16 pb-3.5 px-3.5">
          <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 mb-1.5 drop-shadow-sm">
            {title}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {location && (
                <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{location}</span>
                </span>
              )}
              {verificationLevel && verificationLevel !== 'unverified' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-white/90">
                  <BadgeCheck className="h-3 w-3" />
                  {t('listingCard.verified')}
                </span>
              )}
            </div>
            {pricePerDay > 0 && (
              <span className="font-bold text-sm text-white tabular-nums">RM{pricePerDay}<span className="text-[11px] font-normal text-white/70">{t('listingCard.perDay')}</span></span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

export { ListingCard, type ListingCardProps };