import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "subtle" | "elevated" | "interactive";
  padding?: "sm" | "md" | "lg" | "none";
}

const variantStyles: Record<string, string> = {
  subtle: "glass-1",
  elevated: "glass-2 shadow-3",
  interactive: "glass-1 shadow-1 hover:shadow-3 hover-lift cursor-pointer",
};

const paddingStyles: Record<string, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  none: "p-0",
};

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "subtle", padding = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl transition-all duration-200",
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
