import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  showRetry?: boolean;
  onRetry?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  showRetry = false,
  onRetry,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{description}</p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {actionLabel && onAction && (
          <Button onClick={onAction} className="w-full">{actionLabel}</Button>
        )}
        {showRetry && onRetry && (
          <Button onClick={onRetry} variant="outline" className="w-full">
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
