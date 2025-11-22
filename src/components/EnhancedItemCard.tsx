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
    <Link to={`/items/${id}`} aria-label={`View details for ${title}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200 group">
          <div className="relative">
            {/* Image */}
            <div className="relative h-56 overflow-hidden">
              <img
                src={optimizedImage}
                alt={`${title} - ${category} available for rent in ${location}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                decoding="async"
              />
            </div>

            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
              <div className="flex flex-col gap-2">
                {badgeConfig && (
                  <Badge variant={badgeConfig.variant} className="shadow-lg">
                    {badgeConfig.text}
                  </Badge>
                )}
                <Badge variant="secondary" className="shadow-lg capitalize">
                  {category}
                </Badge>
              </div>
              
              {/* Save button */}
              <div className="hover:scale-105 transition-transform duration-150">
                <SaveItemButton itemId={id} />
              </div>
            </div>
          </div>

          <CardContent className="p-4">
            {/* Title with verification */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-lg line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                {title}
              </h3>
              {isOwnerVerified && (
                <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
              )}
            </div>

            {/* Rating */}
            {rating > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  <span className="text-sm font-medium">{rating}</span>
                </div>
                {reviewCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                  </span>
                )}
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{location}</span>
              {distance && (
                <span className="text-xs">• {distance}km away</span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2 pt-3 border-t">
              <span className="text-2xl font-bold text-primary">
                RM {pricePerDay}
              </span>
              <span className="text-sm text-muted-foreground">/day</span>
            </div>
          </CardContent>
        </Card>
      </Link>
  );
});

EnhancedItemCard.displayName = "EnhancedItemCard";
