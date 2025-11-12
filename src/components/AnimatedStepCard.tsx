import { memo } from "react";
import { useInView } from "react-intersection-observer";
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface AnimatedStepCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  step: number;
  isLast?: boolean;
}

export const AnimatedStepCard = memo(({
  icon,
  title,
  description,
  step,
  isLast = false,
}: AnimatedStepCardProps) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  const prefersReducedMotion = useReducedMotion();

  return (
    <div ref={ref} className="relative">
      <div
        className={`${
          inView && !prefersReducedMotion ? 'animate-fade-in animate-scale-in' : ''
        }`}
        style={{ animationDelay: `${step * 0.2}s` }}
      >
        <Card className="glass-card p-6 text-center relative group hover:shadow-xl transition-all duration-300">
          {/* Step number badge */}
          <div
            className={`absolute -top-3 -left-3 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${
              !prefersReducedMotion ? 'animate-pulse' : ''
            }`}
            aria-label={`Step ${step}`}
          >
            {step}
          </div>

          {/* Icon with glow animation */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4 relative group/icon">
            <div className={`absolute inset-0 rounded-full bg-primary/20 blur-md ${!prefersReducedMotion ? 'animate-pulse' : ''}`} />
            <div className="relative z-10 transition-transform duration-600 group-hover/icon:rotate-360">{icon}</div>
          </div>

          {/* Title */}
          <h3 className="font-heading font-semibold text-xl mb-3">{title}</h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>

          {/* Hover effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
        </Card>
      </div>

      {/* Connecting arrow */}
      {!isLast && (
        <div
          className={`hidden lg:flex absolute top-1/2 -right-8 transform -translate-y-1/2 text-primary ${
            inView && !prefersReducedMotion ? 'animate-fade-in' : ''
          }`}
          style={{ animationDelay: `${step * 0.2 + 0.3}s` }}
          aria-hidden="true"
        >
          <ArrowRight className="w-8 h-8" />
        </div>
      )}
    </div>
  );
});

AnimatedStepCard.displayName = "AnimatedStepCard";
