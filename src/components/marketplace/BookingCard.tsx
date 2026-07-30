import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, CheckCircle2, Circle, Loader2 } from "lucide-react";

type BookingStatus =
  | "requested"
  | "payment_pending"
  | "reserved"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "declined";

interface BookingTimelineStep {
  label: string;
  status: "done" | "current" | "pending" | "skipped";
}

interface BookingCardProps {
  id: string;
  itemTitle: string;
  itemImage?: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  totalPrice: number;
  renterName?: string;
  ownerName?: string;
  isOwner?: boolean;
  onAction?: (action: string) => void;
  className?: string;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Requested",
  payment_pending: "Payment Pending",
  reserved: "Reserved",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

const STATUS_VARIANTS: Record<BookingStatus, "warning" | "default" | "success" | "secondary" | "destructive"> = {
  requested: "warning",
  payment_pending: "warning",
  reserved: "default",
  confirmed: "default",
  active: "success",
  completed: "success",
  cancelled: "destructive",
  declined: "destructive",
};

const getTimeline = (status: BookingStatus): BookingTimelineStep[] => {
  const allSteps = [
    { label: "Requested", status: "done" as const },
    { label: "Paid", status: "pending" as const },
    { label: "Confirmed", status: "pending" as const },
    { label: "Active", status: "pending" as const },
    { label: "Completed", status: "pending" as const },
  ];

  const statusOrder: BookingStatus[] = [
    "requested", "reserved", "confirmed", "active", "completed",
  ];

  const idx = statusOrder.indexOf(status);
  if (idx === -1) {
    return allSteps.map((s) => ({ ...s, status: "skipped" as const }));
  }

  return allSteps.map((step, i) => ({
    ...step,
    status: i < idx ? "done" as const : i === idx ? "current" as const : "pending" as const,
  }));
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
};

const BookingCard = ({
  itemTitle,
  itemImage,
  status,
  startDate,
  endDate,
  totalPrice,
  renterName,
  isOwner,
  className,
}: BookingCardProps) => {
  const timeline = getTimeline(status);
  const isTerminal = status === "completed" || status === "cancelled" || status === "declined";

  return (
    <GlassCard variant="subtle" padding="md" className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {itemImage && (
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
              <img
                src={itemImage}
                alt={itemTitle}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{itemTitle}</h4>
            {renterName && !isOwner && (
              <p className="text-xs text-muted-foreground">Owner: {renterName}</p>
            )}
          </div>
        </div>
        <Badge variant={STATUS_VARIANTS[status]}>
          {STATUS_LABELS[status]}
        </Badge>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(startDate)} - {formatDate(endDate)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {timeline.map((step, i) => (
          <div key={i} className="flex items-center gap-1">
            {step.status === "done" && (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
            {step.status === "current" && (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            )}
            {step.status === "pending" && (
              <Circle className="h-4 w-4 text-muted" />
            )}
            {step.status === "skipped" && (
              <Circle className="h-4 w-4 text-destructive/40" />
            )}
            <span
              className={cn(
                "text-[10px] font-medium",
                step.status === "done" && "text-success",
                step.status === "current" && "text-primary",
                step.status === "pending" && "text-muted-foreground",
                step.status === "skipped" && "text-muted-foreground/40 line-through"
              )}
            >
              {step.label}
            </span>
            {i < timeline.length - 1 && (
              <span
                className={cn(
                  "w-4 h-px mx-1",
                  step.status === "done" ? "bg-success" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {!isTerminal && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <span className="text-xs text-muted-foreground">Total</span>
            <p className="font-bold tabular-nums">RM{totalPrice.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {isOwner ? "Awaiting your action" : "Waiting for owner"}
            </span>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

export { BookingCard, type BookingCardProps, type BookingStatus };
