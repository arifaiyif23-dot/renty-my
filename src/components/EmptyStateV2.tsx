import { type ElementType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

interface EmptyStateV2Props {
  icon?: ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
}

const EmptyStateV2 = ({
  icon: Icon = Package,
  title,
  description,
  actionLabel,
  onAction,
  className,
  variant = 'default',
}: EmptyStateV2Props) => {
  const isCompact = variant === 'compact';
  return (
    <div className={cn("card-base p-6 text-center", className)}>
      <div className={cn("flex flex-col items-center gap-4", isCompact ? "py-4" : "py-8")}>
        <div className={cn("rounded-2xl bg-muted flex items-center justify-center", isCompact ? "w-12 h-12" : "w-16 h-16")}>
          <Icon className={cn("text-muted-foreground/60", isCompact ? "h-6 w-6" : "h-8 w-8")} />
        </div>
        <div className="max-w-xs">
          <h3 className={cn("font-semibold mb-1", isCompact ? "text-base" : "text-lg")}>{title}</h3>
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
    </div>
  );
};

export { EmptyStateV2 };
