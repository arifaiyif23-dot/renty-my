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
      <Card className="card-minimal p-5 text-center hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 border-border/50">
        <div className="w-14 h-14 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:from-primary/25 group-hover:to-primary/10 transition-colors">
          <Icon className="w-7 h-7 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-base mb-0.5 group-hover:text-primary transition-colors">
            {name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
          {minPrice && (
            <p className="text-xs text-primary/80 font-medium mt-1">
              From RM{minPrice}/day
            </p>
          )}
        </div>
      </Card>
    </div>
  );
});

AnimatedCategoryIcon.displayName = "AnimatedCategoryIcon";
