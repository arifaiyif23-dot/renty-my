import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";

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
}: ItemCardProps) => {
  return (
    <Link to={`/items/${id}`}>
      <Card className="group overflow-hidden rounded-xl border-border/50 transition-all hover:shadow-lg hover:scale-[1.02]">
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          <Badge className="absolute top-3 left-3 bg-card/90 text-foreground border-border">
            {category}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground line-clamp-1">{title}</h3>
            <div className="flex items-center gap-1 text-sm shrink-0">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="font-medium">{rating}</span>
              <span className="text-muted-foreground">({reviewCount})</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="line-clamp-1">{location}</span>
            {distance && <span className="shrink-0">· {distance}</span>}
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold text-primary">RM{pricePerDay}</span>
              <span className="text-sm text-muted-foreground">/day</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default ItemCard;
