import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-secondary/40 text-muted-foreground",
  requested: "bg-warning/20 text-warning",
  payment_pending: "bg-warning/20 text-warning",
  reserved: "bg-primary/20 text-primary",
  confirmed: "bg-primary/20 text-primary",
  active: "bg-success/20 text-success",
  completed: "bg-success/20 text-success",
  cancelled: "bg-destructive/20 text-destructive",
  rejected: "bg-destructive/20 text-destructive",
  disputed: "bg-warning/20 text-warning",
  overdue: "bg-destructive/20 text-destructive",
};

interface RentalStatusBadgeProps {
  status: string;
  className?: string;
}

export function RentalStatusBadge({ status, className }: RentalStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {t(`rental.statusLabels.${status}`, status)}
    </Badge>
  );
}
