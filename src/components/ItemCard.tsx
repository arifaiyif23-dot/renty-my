import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, ShieldCheck } from "lucide-react";
import { SaveItemButton } from "./SaveItemButton";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOptimizedImageUrl } from "@/utils/imageOptimization";

interface ItemCardProps {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category: string;
  rating: number;
  reviewCount: number;
  location: string;
  distance?: string;
  isOwnerVerified?: boolean;
  owner_id?: string;
}

const ItemCard = ({
  id,
  title,
  image,
  pricePerDay,
  category,
  rating,
  reviewCount,
  location,
  distance,
  isOwnerVerified: initialIsOwnerVerified = false,
  owner_id,
}: ItemCardProps) => {
  const [isOwnerVerified, setIsOwnerVerified] = useState(initialIsOwnerVerified);

  // Optimize image URL based on network quality
  const optimizedImage = useMemo(
    () => getOptimizedImageUrl(image, { width: 600, quality: 75 }),
    [image]
  );

  useEffect(() => {
    if (owner_id && !initialIsOwnerVerified) {
      let cancelled = false;
      const checkOwnerVerification = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('is_verified')
            .eq('id', owner_id)
            .single();
          
          if (error) throw error;
          if (!cancelled && data?.is_verified) {
            setIsOwnerVerified(true);
          }
        } catch (err) {
          console.error('Failed to check owner verification:', err);
        }
      };

      checkOwnerVerification();
      return () => { cancelled = true; };
    }
  }, [owner_id, initialIsOwnerVerified]);

  return (
    <Link to={`/items/${id}`}>
      <Card className="group overflow-hidden rounded-xl border-border/50 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] min-h-[44px]">
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          <img
            src={optimizedImage}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
          <Badge className="absolute top-2 md:top-3 left-2 md:left-3 bg-card/90 text-foreground border-border text-xs">
            {category}
          </Badge>
          {isOwnerVerified && (
            <Badge variant="secondary" className="absolute top-2 md:top-3 right-2 md:right-3 gap-1">
              <ShieldCheck className="h-3 w-3 text-green-500" />
              Verified
            </Badge>
          )}
          <div className="absolute bottom-2 right-2 z-10">
            <SaveItemButton itemId={id} variant="ghost" size="icon" />
          </div>
        </div>

        {/* Content */}
        <div className="p-3 md:p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm md:text-base text-foreground line-clamp-2 flex-1">
              {title}
            </h3>
            {rating > 0 && (
              <div className="flex items-center gap-1 text-xs md:text-sm shrink-0">
                <Star className="h-3.5 w-3.5 md:h-4 md:w-4 fill-primary text-primary" />
                <span className="font-medium">{rating}</span>
                {reviewCount > 0 && (
                  <span className="text-muted-foreground hidden sm:inline">({reviewCount})</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
            <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" />
            <span className="line-clamp-1 flex-1">{location}</span>
            {distance && <span className="shrink-0 hidden sm:inline">· {distance}</span>}
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-baseline gap-1">
              <span className="text-lg md:text-xl font-semibold text-primary">RM{pricePerDay}</span>
              <span className="text-xs md:text-sm text-muted-foreground">/day</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default ItemCard;
