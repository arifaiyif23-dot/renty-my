import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, ShieldCheck } from "lucide-react";
import { SaveItemButton } from "@/components/SaveItemButton";
import { cn } from "@/lib/utils";
import { getOptimizedImageUrl } from "@/utils/imageOptimization";

interface EnhancedItemCardProps {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category: string;
  rating?: number;
  reviewCount?: number;
  location: string;
  distance?: number;
  isOwnerVerified?: boolean;
  badge?: "trending" | "just-listed" | "available";
}

export const EnhancedItemCard = memo(({
  id,
  title,
  image,
  pricePerDay,
  category,
  rating = 0,
  reviewCount = 0,
  location,
  distance,
  isOwnerVerified,
  badge,
}: EnhancedItemCardProps) => {
  const badgeConfig = useMemo(() => {
    switch (badge) {
      case "trending":
        return { text: "🔥 Trending", variant: "destructive" as const };
      case "just-listed":
        return { text: "✨ Just Listed", variant: "secondary" as const };
      case "available":
        return { text: "✅ Available Now", variant: "default" as const };
      default:
        return null;
    }
  }, [badge]);

  // Optimize image URL based on network quality
  const optimizedImage = useMemo(
    () => getOptimizedImageUrl(image, { width: 800, quality: 80 }),
    [image]
  );

  return (
    <Link to={`/items/${id}`} aria-label={`View details for ${title}`} className="block group">
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-2 hover:-translate-y-0.5">
          <div className="relative">
            <div className="relative h-56 overflow-hidden bg-muted">
              <img
                src={optimizedImage}
                alt={`${title} - ${category} available for rent in ${location}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                {badgeConfig && (
                  <Badge variant={badgeConfig.variant} className="shadow-1 backdrop-blur">
                    {badgeConfig.text}
                  </Badge>
                )}
                <Badge variant="soft" className="capitalize shadow-1 backdrop-blur">
                  {category}
                </Badge>
              </div>

              <div className="press">
                <SaveItemButton itemId={id} />
              </div>
            </div>
          </div>

          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-base leading-snug line-clamp-1 flex-1 group-hover:text-primary transition-colors">
                {title}
              </h3>
              {isOwnerVerified && (
                <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" aria-label="Verified owner" />
              )}
            </div>

            {rating > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-warning text-warning" />
                  <span className="text-sm font-medium tabular">{rating.toFixed(1)}</span>
                </div>
                {reviewCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{location}</span>
              {distance && (
                <span className="text-xs tabular whitespace-nowrap">· {distance}km</span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 pt-3 border-t border-border">
              <span className="text-xl md:text-2xl font-bold text-primary tabular">
                RM{pricePerDay}
              </span>
              <span className="text-xs text-muted-foreground">/hari</span>
            </div>
          </CardContent>
        </Card>
      </Link>
  );
});


EnhancedItemCard.displayName = "EnhancedItemCard";
