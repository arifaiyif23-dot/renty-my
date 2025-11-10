import { memo } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

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

  return (
    <div ref={ref} className="relative">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{
          duration: 0.5,
          delay: step * 0.2,
          type: "spring",
          stiffness: 100,
        }}
      >
        <Card className="glass-card p-6 text-center relative group hover:shadow-xl transition-all duration-300">
          {/* Step number badge */}
          <motion.div
            className="absolute -top-3 -left-3 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg shadow-lg"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {step}
          </motion.div>

          {/* Icon with glow animation */}
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4 relative"
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-primary/20 blur-md"
            />
            <div className="relative z-10">{icon}</div>
          </motion.div>

          {/* Title */}
          <h3 className="font-heading font-semibold text-xl mb-3">{title}</h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>

          {/* Hover effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
        </Card>
      </motion.div>

      {/* Connecting arrow */}
      {!isLast && (
        <motion.div
          className="hidden lg:flex absolute top-1/2 -right-8 transform -translate-y-1/2 text-primary"
          initial={{ opacity: 0, x: -20 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: step * 0.2 + 0.3 }}
        >
          <ArrowRight className="w-8 h-8" />
        </motion.div>
      )}
    </div>
  );
});

AnimatedStepCard.displayName = "AnimatedStepCard";
