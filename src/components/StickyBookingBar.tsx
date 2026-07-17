import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickyBookingBarProps {
  pricePerDay: number;
  rating?: number;
  reviewCount?: number;
  onBook: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  instantBookEnabled?: boolean;
  totalPrice?: number;
  dateLabel?: string;
}

export default function StickyBookingBar({
  pricePerDay,
  rating = 0,
  reviewCount = 0,
  onBook,
  disabled = false,
  isLoading = false,
  className,
  instantBookEnabled = false,
  totalPrice,
  dateLabel,
}: StickyBookingBarProps) {
  const hasDates = !!dateLabel;
  const buttonLabel = isLoading ? "Processing..." : !hasDates ? "Select Dates" : instantBookEnabled ? "Instant Book" : "Book Now";

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md p-3 md:hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">RM{pricePerDay}</span>
            <span className="text-sm font-normal text-muted-foreground">/day</span>
            {totalPrice != null && hasDates && (
              <>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="text-sm font-semibold tabular-nums text-primary">RM{totalPrice} total</span>
              </>
            )}
          </div>
          {dateLabel && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {dateLabel}
            </div>
          )}
          {rating > 0 && !hasDates && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
              {reviewCount > 0 && <span>({reviewCount})</span>}
            </div>
          )}
        </div>
        <Button
          size="lg"
          className="flex-shrink-0 min-w-[120px]"
          onClick={onBook}
          disabled={disabled || isLoading || !hasDates}
        >
          {isLoading ? "Processing..." : buttonLabel}
        </Button>
      </div>
    </div>
  );
}
