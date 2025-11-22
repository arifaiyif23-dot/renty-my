import { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedCategoryIconProps {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  count: number;
  minPrice?: number;
  onClick: () => void;
}

export const AnimatedCategoryIcon = memo(({
  icon: Icon,
  name,
  count,
  minPrice,
  onClick,
}: AnimatedCategoryIconProps) => {
  return (
    <div 
      className="group cursor-pointer"
      onClick={onClick}
      onKeyPress={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      aria-label={`Browse ${name} category with ${count} items${minPrice ? ` starting from RM ${minPrice}` : ''}`}
    >
      <Card className="card-minimal p-6 text-center hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
          {minPrice && (
            <p className="text-xs text-primary font-medium mt-1">
              From RM {minPrice}/day
            </p>
          )}
        </div>
      </Card>
    </div>
  );
});

AnimatedCategoryIcon.displayName = "AnimatedCategoryIcon";
