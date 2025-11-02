import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Check } from "lucide-react";
import { motion } from "framer-motion";

interface InsurancePlan {
  type: 'basic' | 'premium' | 'platinum';
  name: string;
  coverage: number;
  price: number;
  features: string[];
  recommended?: boolean;
}

const INSURANCE_PLANS: InsurancePlan[] = [
  {
    type: 'basic',
    name: 'Basic Protection',
    coverage: 5000,
    price: 0,
    features: [
      'Up to RM 5,000 coverage',
      'Accidental damage',
      'Basic support',
    ],
  },
  {
    type: 'premium',
    name: 'Premium Protection',
    coverage: 20000,
    price: 10,
    features: [
      'Up to RM 20,000 coverage',
      'Accidental damage',
      'Water damage',
      'Priority support',
    ],
    recommended: true,
  },
  {
    type: 'platinum',
    name: 'Platinum Protection',
    coverage: 50000,
    price: 25,
    features: [
      'Up to RM 50,000 coverage',
      'Accidental damage',
      'Water damage',
      'Theft protection',
      '24/7 Premium support',
      'Express replacement',
    ],
  },
];

interface InsurancePlansProps {
  onPlanSelect: (plan: { type: string; coverage: number; price: number }) => void;
  selectedPlan?: string;
  rentalDays: number;
}

export const InsurancePlans = ({ onPlanSelect, selectedPlan = 'basic', rentalDays }: InsurancePlansProps) => {
  const [selected, setSelected] = useState(selectedPlan);

  const handleSelect = (plan: InsurancePlan) => {
    setSelected(plan.type);
    onPlanSelect({
      type: plan.type,
      coverage: plan.coverage,
      price: plan.price,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Select Insurance Protection</h3>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {INSURANCE_PLANS.map((plan) => (
          <motion.div
            key={plan.type}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className={`p-6 cursor-pointer transition-all relative ${
                selected === plan.type
                  ? 'border-primary border-2 shadow-lg'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleSelect(plan)}
            >
              {plan.recommended && (
                <Badge className="absolute top-4 right-4" variant="default">
                  Recommended
                </Badge>
              )}

              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-lg mb-1">{plan.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Coverage up to RM {plan.coverage.toLocaleString()}
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {plan.price === 0 ? 'Free' : `RM ${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground">/day</span>
                  )}
                </div>

                {plan.price > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: RM {(plan.price * rentalDays).toFixed(2)} for {rentalDays} days
                  </p>
                )}

                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {selected === plan.type && (
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm pt-2">
                    <Check className="w-5 h-5" />
                    Selected
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
