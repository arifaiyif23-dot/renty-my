import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedCategoryIconProps {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  count: number;
  minPrice?: number;
  onClick: () => void;
}

export const AnimatedCategoryIcon = ({
  icon: Icon,
  name,
  count,
  minPrice,
  onClick,
}: AnimatedCategoryIconProps) => {
  return (
    <div className="hover:scale-105 active:scale-95 transition-transform duration-300 animate-fade-in">
      <Card
        className={cn(
          "relative p-6 text-center cursor-pointer overflow-hidden",
          "glass-card hover:shadow-xl transition-all duration-300",
          "group"
        )}
        onClick={onClick}
      >
        {/* Icon */}
        <div className="mb-3 flex items-center justify-center">
          <Icon className="w-12 h-12 text-primary group-hover:animate-pulse" />
        </div>

        {/* Name */}
        <h3 className="font-semibold text-base mb-1">{name}</h3>

        {/* Count */}
        <p className="text-sm text-muted-foreground mb-2">{count} items</p>

        {/* Price on hover */}
        {minPrice && (
          <div className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-0 group-hover:h-auto overflow-hidden">
            From RM {minPrice}/day
          </div>
        )}

        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </Card>
    </div>
  );
};
