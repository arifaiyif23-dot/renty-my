import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VerificationBadgeProps {
  isVerified: boolean;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export const VerificationBadge = ({ 
  isVerified, 
  size = "md",
  showText = false 
}: VerificationBadgeProps) => {
  if (!isVerified) return null;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  const iconSize = sizeClasses[size];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1">
            <BadgeCheck className={`${iconSize} text-primary`} />
            {showText && (
              <span className="text-xs font-medium text-primary">Verified</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <div>
              <p className="font-semibold">Verified User</p>
              <p className="text-xs text-muted-foreground">
                ID verified • Email verified • Phone verified
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
