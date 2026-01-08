import { Button } from "@/components/ui/button";
import { LucideIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnhancedEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  showRetry?: boolean;
  onRetry?: () => void;
  variant?: "default" | "compact" | "illustration";
}

export default function EnhancedEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  showRetry = false,
  onRetry,
  variant = "default",
}: EnhancedEmptyStateProps) {
  const isCompact = variant === "compact";
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      isCompact ? "py-8 px-4" : "py-16 px-6"
    )}>
      {/* Decorative background circles */}
      <div className="relative mb-6">
        <div className={cn(
          "absolute inset-0 rounded-full bg-primary/5 blur-xl",
          isCompact ? "scale-150" : "scale-[2]"
        )} />
        <div className={cn(
          "relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/50 border border-border/50",
          isCompact ? "w-14 h-14" : "w-20 h-20"
        )}>
          <Icon className={cn(
            "text-muted-foreground",
            isCompact ? "h-7 w-7" : "h-10 w-10"
          )} />
        </div>
      </div>
      
      <h3 className={cn(
        "font-semibold text-foreground",
        isCompact ? "text-base mb-1" : "text-xl mb-2"
      )}>
        {title}
      </h3>
      
      <p className={cn(
        "text-muted-foreground max-w-sm",
        isCompact ? "text-sm mb-4" : "text-base mb-8"
      )}>
        {description}
      </p>
      
      <div className={cn(
        "flex flex-col gap-3 w-full",
        isCompact ? "max-w-[200px]" : "max-w-xs"
      )}>
        {actionLabel && onAction && (
          <Button 
            onClick={onAction} 
            className="w-full group"
            size={isCompact ? "sm" : "default"}
          >
            {actionLabel}
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}
        
        {secondaryActionLabel && onSecondaryAction && (
          <Button 
            onClick={onSecondaryAction} 
            variant="outline" 
            className="w-full"
            size={isCompact ? "sm" : "default"}
          >
            {secondaryActionLabel}
          </Button>
        )}
        
        {showRetry && onRetry && (
          <Button 
            onClick={onRetry} 
            variant="ghost" 
            className="w-full text-muted-foreground"
            size={isCompact ? "sm" : "default"}
          >
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
