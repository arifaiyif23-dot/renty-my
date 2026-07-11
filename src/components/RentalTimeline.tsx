import { CheckCircle, Circle, Clock, Package, Truck, XCircle } from 'lucide-react';
import { Rental } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RentalTimelineProps {
  rental: Rental;
}

export function RentalTimeline({ rental }: RentalTimelineProps) {
  const timelineSteps = [
    {
      label: 'Booking Created',
      date: rental.created_at,
      status: 'completed' as const,
      icon: Package,
    },
    {
      label: 'Approved',
      date: rental.status === 'pending' ? null : rental.created_at,
      status: rental.status === 'pending' ? 'pending' : rental.status === 'rejected' ? 'failed' : 'completed' as const,
      icon: CheckCircle,
    },
    {
      label: 'Rental Started',
      date: new Date() >= new Date(rental.start_date) ? rental.start_date : null,
      status: new Date() >= new Date(rental.start_date) ? 'completed' : 'pending' as const,
      icon: Truck,
    },
    {
      label: 'Rental Ended',
      date: new Date() >= new Date(rental.end_date) ? rental.end_date : null,
      status: rental.status === 'completed' ? 'completed' : new Date() >= new Date(rental.end_date) ? 'pending' : 'pending' as const,
      icon: Clock,
    },
    {
      label: 'Completed',
      date: rental.status === 'completed' ? rental.end_date : null,
      status: rental.status === 'completed' ? 'completed' : rental.status === 'cancelled' ? 'failed' : 'pending' as const,
      icon: rental.status === 'cancelled' ? XCircle : CheckCircle,
    },
  ];

  return (
    <div className="relative">
      {timelineSteps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === timelineSteps.length - 1;

        return (
          <div key={step.label} className="flex gap-4 pb-8 relative">
            {/* Line connector */}
            {!isLast && (
              <div
                className={cn(
                  "absolute left-4 top-8 w-0.5 h-full",
                  step.status === 'completed' ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}

            {/* Icon */}
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

            {/* Content */}
            <div className="flex-1">
              <div className="font-medium">{step.label}</div>
              {step.date && (
                <div className="text-sm text-muted-foreground">
                  {format(new Date(step.date), 'MMM d, yyyy')}
                </div>
              )}
              {step.status === 'pending' && !step.date && (
                <div className="text-sm text-muted-foreground">Pending</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
