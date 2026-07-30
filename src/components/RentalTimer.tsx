import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RentalTimerProps {
  startDate: string;
  endDate: string;
  actualStartAt?: string | null;
}

function calcRemaining(end: Date): { days: number; hours: number; totalHours: number; pct: number } {
  const now = new Date();
  const remaining = end.getTime() - now.getTime();
  if (remaining <= 0) return { days: 0, hours: 0, totalHours: 0, pct: 100 };

  const totalHours = remaining / (1000 * 60 * 60);
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  const totalDays = Math.ceil((end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return { days, hours, totalHours, pct: Math.min(100, Math.max(0, 100 - (totalDays / 365) * 100)) };
}

function calcElapsed(start: Date, end: Date): { days: number; hours: number; pct: number } {
  const now = new Date();
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  if (total <= 0) return { days: 0, hours: 0, pct: 0 };

  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const elapsedHours = elapsed / (1000 * 60 * 60);
  const days = Math.floor(elapsedHours / 24);
  const hours = Math.floor(elapsedHours % 24);

  return { days, hours, pct };
}

export function RentalTimer({ startDate, endDate, actualStartAt }: RentalTimerProps) {
  const { t } = useTranslation();
  const actualStart = actualStartAt ? new Date(actualStartAt) : null;
  const end = new Date(endDate);
  const start = actualStart || new Date(startDate);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = calcElapsed(start, end);
  const remaining = calcRemaining(end);
  const isOverdue = now > end;
  const isActive = now >= start && now <= end;

  if (!isActive && !isOverdue) return null;

  return (
    <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {isOverdue ? t('rental.overdue') : t('rental.remaining')}
        </span>
        <span className={cn(
          "font-semibold tabular-nums",
          isOverdue && "text-destructive"
        )}>
          {isOverdue
            ? t('rental.overdueBy', { days: Math.abs(remaining.days), hours: Math.abs(remaining.hours) })
            : remaining.days > 0
              ? t('rental.daysRemaining', { days: remaining.days })
              : t('rental.hoursRemaining', { hours: remaining.hours })}
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOverdue ? "bg-destructive" : elapsed.pct > 80 ? "bg-warning" : "bg-success"
          )}
          style={{ width: `${Math.min(elapsed.pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
