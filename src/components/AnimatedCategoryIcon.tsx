import { memo } from "react";
import { Card } from "@/components/ui/card";

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
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      aria-label={`Browse ${name} category with ${count} items${minPrice ? ` starting from RM ${minPrice}` : ''}`}
    >
      <Card className="card-minimal p-5 text-center hover:border-primary/40 active:scale-[0.98] transition-all duration-200">
        <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 transition-colors">
          <Icon className="w-6 h-6 text-foreground/80 group-hover:text-primary transition-colors" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-medium text-sm mb-0.5 text-foreground">
            {name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
          {minPrice !== undefined && minPrice > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              From RM{minPrice}/day
            </p>
          )}
        </div>
      </Card>
    </div>
  );
});

AnimatedCategoryIcon.displayName = "AnimatedCategoryIcon";
