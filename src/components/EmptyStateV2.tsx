import { type ElementType } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

interface EmptyStateV2Props {
  icon?: ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyStateV2 = ({
  icon: Icon = Package,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateV2Props) => {
  return (
    <GlassCard
      variant="subtle"
      padding="lg"
      className={cn("text-center", className)}
    >
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Icon className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="max-w-xs">
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actionLabel && onAction && (
          <Button variant="default" onClick={onAction} className="mt-2">
            {actionLabel}
          </Button>
        )}
      </div>
    </GlassCard>
  );
};

export { EmptyStateV2 };
