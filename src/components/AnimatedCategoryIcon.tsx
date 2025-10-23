import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedCategoryIconProps {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  count: number;
  minPrice?: number;
  onClick: () => void;
}

export const AnimatedCategoryIcon = ({
  icon: Icon,
  name,
  count,
  minPrice,
  onClick,
}: AnimatedCategoryIconProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, rotateY: 5 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card
        className={cn(
          "relative p-6 text-center cursor-pointer overflow-hidden",
          "glass-card hover:shadow-xl transition-all duration-300",
          "group"
        )}
        onClick={onClick}
      >
        {/* Icon */}
        <motion.div
          className="mb-3 flex items-center justify-center"
          whileHover={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="w-12 h-12 text-primary" />
        </motion.div>

        {/* Name */}
        <h3 className="font-semibold text-base mb-1">{name}</h3>

        {/* Count */}
        <p className="text-sm text-muted-foreground mb-2">{count} items</p>

        {/* Price on hover */}
        {minPrice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            whileHover={{ opacity: 1, height: "auto" }}
            className="text-xs text-primary font-medium"
          >
            From RM {minPrice}/day
          </motion.div>
        )}

        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </Card>
    </motion.div>
  );
};
