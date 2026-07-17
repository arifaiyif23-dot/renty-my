import { ShieldCheck, Lock, HeadphonesIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FEATURES = [
  {
    icon: ShieldCheck,
    label: "Damage Protection",
    description: "Eligible items are covered against accidental damage during the rental period.",
  },
  {
    icon: Lock,
    label: "Secure Payment",
    description: "Your payment is held securely and only released to the owner after you confirm receipt.",
  },
  {
    icon: HeadphonesIcon,
    label: "24/7 Support",
    description: "Our support team is available around the clock to help with any issues.",
  },
];

export default function PeaceOfMind() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 flex-wrap">
        {FEATURES.map((feature) => (
          <Tooltip key={feature.label}>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                <feature.icon className="h-3.5 w-3.5" />
                <span>{feature.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-60">
              <p className="text-sm">{feature.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
