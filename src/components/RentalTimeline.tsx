import { CheckCircle, Circle, Clock, Package, Truck, XCircle, AlertTriangle, CalendarPlus, CalendarX } from 'lucide-react';
import { Rental } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface TimelineModification {
  id: string;
  type: 'extension' | 'early_return';
  status: string;
  original_end_date: string;
  new_end_date: string;
  price_adjustment: number;
  reason: string | null;
  requested_at: string;
}

interface RentalTimelineProps {
  rental: Rental;
  modifications?: TimelineModification[];
}

const TERMINAL_FAILED = ['rejected', 'cancelled'];
const TERMINAL_DISPUTED = ['disputed'];

export function RentalTimeline({ rental, modifications = [] }: RentalTimelineProps) {
  const isFailed = TERMINAL_FAILED.includes(rental.status);
  const isDisputed = TERMINAL_DISPUTED.includes(rental.status);
  const isTerminal = isFailed || isDisputed;

  const baseSteps = [
    {
      label: 'Booking Created',
      date: rental.created_at,
      status: 'completed' as const,
      icon: Package,
    },
    {
      label: isFailed ? 'Request Declined' : isDisputed ? 'Disputed' : 'Approved',
      date: isTerminal ? null : rental.created_at,
      status: isFailed || isDisputed ? 'failed' as const : 'completed' as const,
      icon: isFailed ? XCircle : isDisputed ? AlertTriangle : CheckCircle,
    },
    {
      label: 'Rental Started',
      date: rental.actual_start_at || (new Date() >= new Date(rental.start_date) ? rental.start_date : null),
      status: isTerminal ? 'pending' as const : rental.actual_start_at ? 'completed' as const : new Date() >= new Date(rental.start_date) ? 'completed' as const : 'pending' as const,
      icon: Truck,
    },
    {
      label: 'Rental Ended',
      date: new Date() >= new Date(rental.end_date) ? rental.end_date : null,
      status: isTerminal ? 'pending' as const : rental.status === 'completed' || rental.status === 'disputed' ? 'completed' as const : new Date() >= new Date(rental.end_date) ? 'completed' as const : 'pending' as const,
      icon: Clock,
    },
    {
      label: isDisputed ? 'Under Review' : isFailed ? 'Not Completed' : 'Completed',
      date: rental.status === 'completed' ? rental.end_date : null,
      status: rental.status === 'completed' ? 'completed' as const : isFailed ? 'failed' as const : isDisputed ? 'failed' as const : 'pending' as const,
      icon: isFailed || isDisputed ? XCircle : CheckCircle,
    },
  ];

  // Inject modification steps between "Rental Started" and "Rental Ended" (index 2 and 3)
  const modSteps = modifications
    .filter(m => m.status === 'approved')
    .map(m => ({
      label: m.type === 'extension' ? 'Rental Extended' : 'Early Return',
      date: m.new_end_date,
      status: 'completed' as const,
      icon: m.type === 'extension' ? CalendarPlus : CalendarX,
      detail: m.type === 'extension'
        ? `Extended to ${format(new Date(m.new_end_date), 'MMM d, yyyy')}`
        : `Returning early on ${format(new Date(m.new_end_date), 'MMM d, yyyy')}`,
    }));

  type TimelineStep = {
    label: string;
    date: string | null;
    status: 'completed' | 'failed' | 'pending';
    icon: typeof Package;
    detail?: string;
  };

  const timelineSteps: TimelineStep[] = [
    ...baseSteps.slice(0, 3),
    ...modSteps,
    ...baseSteps.slice(3),
  ];

  return (
    <div className="relative">
      {timelineSteps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === timelineSteps.length - 1;

        return (
          <div key={step.label} className="flex gap-4 pb-8 relative">
            {!isLast && (
              <div
                className={cn(
                  "absolute left-4 top-8 w-0.5 h-full",
                  step.status === 'completed' ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}

            <div className={cn(
              "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0",
              step.status === 'completed' && 'bg-primary border-primary text-primary-foreground',
              step.status === 'pending' && 'bg-muted border-muted-foreground/30 text-muted-foreground',
              step.status === 'failed' && 'bg-destructive border-destructive text-destructive-foreground'
            )}>
              {step.status === 'pending' ? (
                <Circle className="h-4 w-4 fill-current" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </div>

            <div className="flex-1">
              <div className="font-medium">{step.label}</div>
              {step.detail ? (
                <div className="text-sm text-muted-foreground">{step.detail}</div>
              ) : step.date ? (
                <div className="text-sm text-muted-foreground">
                  {format(new Date(step.date), 'MMM d, yyyy')}
                </div>
              ) : step.status === 'pending' ? (
                <div className="text-sm text-muted-foreground">Pending</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
