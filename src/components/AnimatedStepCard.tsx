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
      <Card className="card-minimal p-6 text-center relative group h-full">
        {/* Step number badge */}
        <div
          className="absolute -top-3 -left-3 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg shadow-md"
          aria-label={`Step ${step}`}
        >
          {step}
        </div>

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          {icon}
        </div>

          {/* Title */}
          <h3 className="font-heading font-semibold text-xl mb-3">{title}</h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </Card>

      {/* Connecting arrow */}
      {!isLast && (
        <div
          className="hidden lg:flex absolute top-1/2 -right-8 transform -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        >
          <ArrowRight className="w-8 h-8" />
        </div>
      )}
    </div>
  );
});

AnimatedStepCard.displayName = "AnimatedStepCard";
