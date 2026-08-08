import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface StickyBookingBarProps {
  pricePerDay: number;
  onBook: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  totalPrice?: number;
  hasDates?: boolean;
  hasTimes?: boolean;
}

export default function StickyBookingBar({
  pricePerDay,
  onBook,
  disabled = false,
  isLoading = false,
  className,
  totalPrice,
  hasDates = false,
  hasTimes = false,
}: StickyBookingBarProps) {
  const { t } = useTranslation();
  const ready = hasDates && hasTimes;
  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 border-t border-border/40 bg-card p-3 md:hidden bottom-mobile-nav",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tabular-nums">RM{pricePerDay}</span>
            <span className="text-sm text-muted-foreground">/day</span>
            {totalPrice != null && ready && (
              <>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">RM{totalPrice} total</span>
              </>
            )}
          </div>
        </div>
        <Button
          size="lg"
          className="flex-shrink-0 min-w-[120px] bg-primary text-primary-foreground"
          onClick={onBook}
          disabled={disabled || isLoading}
        >
          {isLoading
            ? t("rentalTime.booking")
            : !hasDates
              ? t("rentalTime.selectDates")
              : !hasTimes
                ? t("rentalTime.selectTimes")
                : t("rentalTime.bookNow")}
        </Button>
      </div>
    </div>
  );
}
