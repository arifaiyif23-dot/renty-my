import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "subtle" | "elevated" | "interactive";
  padding?: "sm" | "md" | "lg" | "none";
}

const paddingStyles: Record<string, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  none: "p-0",
};

const variantStyles: Record<string, string> = {
  subtle: "bg-card border border-border",
  elevated: "bg-card border border-border",
  interactive: "bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer",
};

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "subtle", padding = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl",
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard, type GlassCardProps };
