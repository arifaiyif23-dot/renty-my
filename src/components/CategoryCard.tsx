import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CategoryCardProps {
  icon: LucideIcon;
  name: string;
  count: number;
  color: string;
}

export const CategoryCard = ({ icon: Icon, name, count, color }: CategoryCardProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card
        className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate(`/search?category=${name.toLowerCase()}`)}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className={`p-4 rounded-full ${color}`}>
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{name}</h3>
            <p className="text-sm text-muted-foreground">{count} items</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
