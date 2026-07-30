import { Circle, Clock, Package, Truck, XCircle, AlertTriangle, CreditCard, CheckCircle, Ban, CalendarPlus, CalendarX } from 'lucide-react';
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

const SOP_SEQUENCE = ['requested', 'payment_pending', 'reserved', 'confirmed', 'active', 'completed'] as const;

type StepStatus = 'completed' | 'failed' | 'pending' | 'warning';

interface TimelineStep {
  label: string;
  date: string | null;
  status: StepStatus;
  icon: typeof Package;
  detail?: string;
}

function stepFor(rental: Rental, status: typeof SOP_SEQUENCE[number], idx: number, currentIdx: number): TimelineStep {
  const isOverdue = rental.status === 'overdue' && status === 'active';
  const isDisputed = rental.status === 'disputed' && status === 'active';
  const dates: Record<string, string | null> = {
    requested: rental.created_at,
    payment_pending: null,
    reserved: null,
    confirmed: null,
    active: rental.actual_start_at || null,
    completed: rental.status === 'completed' || rental.status === 'disputed' ? rental.end_date : null,
  };

  let stepStatus: StepStatus;
  if (idx < currentIdx || (idx === currentIdx && rental.status === status)) {
    stepStatus = isOverdue ? 'warning' : 'completed';
  } else if (idx === currentIdx) {
    stepStatus = 'pending';
  } else {
    stepStatus = 'pending';
  }

  const labels: Record<string, string> = {
    requested: 'Booking Requested',
    payment_pending: 'Payment Initiated',
    reserved: 'Payment Confirmed',
    confirmed: 'Booking Confirmed',
    active: isOverdue ? 'Overdue' : isDisputed ? 'Return Disputed' : 'Rental Started',
    completed: rental.status === 'disputed' ? 'Under Review' : 'Rental Completed',
  };

  const icons: Record<string, typeof Package> = {
    requested: Package,
    payment_pending: CreditCard,
    reserved: CheckCircle,
    confirmed: CheckCircle,
    active: isOverdue ? AlertTriangle : isDisputed ? AlertTriangle : Truck,
    completed: rental.status === 'disputed' ? AlertTriangle : Clock,
  };

  return {
    label: labels[status],
    date: dates[status],
    status: stepStatus,
    icon: icons[status],
  };
}

export function RentalTimeline({ rental, modifications = [] }: RentalTimelineProps) {
  const currentIdx = SOP_SEQUENCE.indexOf(rental.status as typeof SOP_SEQUENCE[number]);
  const isTerminal = ['rejected', 'cancelled'].includes(rental.status);
  const isOverdue = rental.status === 'overdue';
  const isDisputed = rental.status === 'disputed';

  const steps: TimelineStep[] = SOP_SEQUENCE.map((s, i) => {
    if (isTerminal && i > currentIdx) return null;
    if (isOverdue && i > SOP_SEQUENCE.indexOf('active')) return null;
    if (isDisputed && i > SOP_SEQUENCE.indexOf('active')) return null;
    return stepFor(rental, s, i, currentIdx);
  }).filter(Boolean) as TimelineStep[];

  if (isTerminal) {
    const reasonLabel = rental.status === 'rejected' ? 'Booking Declined' : 'Booking Cancelled';
    steps.push({
      label: reasonLabel,
      date: rental.updated_at,
      status: 'failed',
      icon: rental.status === 'rejected' ? XCircle : Ban,
    });
  }

  if (isOverdue) {
    steps.push({
      label: 'Rental Overdue — Return Pending',
      date: null,
      status: 'warning',
      icon: AlertTriangle,
    });
  }

  if (isDisputed) {
    steps.push({
      label: 'Dispute Raised — Awaiting Admin Review',
      date: null,
      status: 'failed',
      icon: AlertTriangle,
    });
  }

  // Inject modification steps between Rental Started and Rental Completed
  const modSteps: TimelineStep[] = modifications
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

  const activeIdx = steps.findIndex(s => s.label.includes('Rental Started') || s.label === 'Overdue' || s.label === 'Return Disputed');
  const combined = activeIdx >= 0
    ? [...steps.slice(0, activeIdx + 1), ...modSteps, ...steps.slice(activeIdx + 1)]
    : steps;

  return (
    <div className="relative">
      {combined.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === combined.length - 1;

        return (
          <div key={`${step.label}-${index}`} className="flex gap-4 pb-8 relative">
            {!isLast && (
              <div className={cn(
                "absolute left-4 top-8 w-0.5 h-full",
                (step.status === 'completed' || (step.status === 'warning' && !isLast)) ? 'bg-primary' : 'bg-muted'
              )} />
            )}

            <div className={cn(
              "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0",
              step.status === 'completed' && 'bg-primary border-primary text-primary-foreground',
              step.status === 'pending' && 'bg-muted border-muted-foreground/30 text-muted-foreground',
              step.status === 'failed' && 'bg-destructive border-destructive text-destructive-foreground',
              step.status === 'warning' && 'bg-warning border-warning text-warning-foreground'
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
              ) : step.status === 'warning' ? (
                <div className="text-sm text-warning">Action required</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
