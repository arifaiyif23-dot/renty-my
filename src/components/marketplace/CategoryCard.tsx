import { type ElementType } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

interface CategoryCardProps {
  icon: ElementType;
  name: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

const CategoryCard = ({
  icon: Icon,
  name,
  count,
  active = false,
  onClick,
  className,
}: CategoryCardProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg",
        active && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <GlassCard
        variant={active ? "elevated" : "interactive"}
        padding="md"
        className={cn(
          "flex flex-col items-center text-center gap-2",
          active && "bg-primary/5",
          className
        )}
      >
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-200",
            active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground/70"
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          {count !== undefined && (
            <p className="text-xs text-muted-foreground">{count} items</p>
          )}
        </div>
      </GlassCard>
    </button>
  );
};

export { CategoryCard, type CategoryCardProps };
