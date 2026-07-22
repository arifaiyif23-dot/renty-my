import { Shield, ShieldCheck, ShieldHalf, BadgeCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VerificationLevel } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface UserTrustBadgeProps {
  level?: VerificationLevel;
  trustScore?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LEVEL_CONFIG: Record<VerificationLevel, { label: string; icon: typeof Shield; color: string; description: string }> = {
  unverified: { label: 'Unverified', icon: Shield, color: 'text-muted-foreground', description: 'Identity not yet verified' },
  email: { label: 'Email Verified', icon: ShieldHalf, color: 'text-primary', description: 'Email address confirmed' },
  basic: { label: 'Basic Verified', icon: ShieldHalf, color: 'text-success', description: 'Basic identity check completed' },
  kyc: { label: 'KYC Verified', icon: ShieldCheck, color: 'text-primary', description: 'Full identity verified via document upload' },
  premium: { label: 'Premium Verified', icon: BadgeCheck, color: 'text-brand-blue', description: 'Enhanced eKYC verification completed' },
};

export function UserTrustBadge({ level = 'unverified', trustScore, showScore, size = 'md', className }: UserTrustBadgeProps) {
  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center gap-1 cursor-help', className)}>
            <Icon className={cn(sizeClass, config.color)} />
            <span className={cn(
              'font-medium',
              size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs',
              config.color
            )}>
              {config.label}
            </span>
            {showScore && trustScore != null && (
              <span className="text-xs text-muted-foreground ml-1">
                ({trustScore}/100)
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm">{config.description}</p>
          {trustScore != null && (
            <p className="text-xs text-muted-foreground mt-1">Trust Score: {trustScore}/100</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface TrustScoreRingProps {
  score: number;
  size?: number;
  className?: string;
}

export function TrustScoreRing({ score, size = 48, className }: TrustScoreRingProps) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(score, 100) / 100) * circumference;

  const color = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span className={cn('absolute text-xs font-bold', color)}>
        {score}
      </span>
    </div>
  );
}
