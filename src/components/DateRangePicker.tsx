import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  itemId?: string;
}

export function DateRangePicker({ dateRange, setDateRange, itemId }: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);

  useEffect(() => {
    if (itemId) {
      fetchBookedDates();
    }
  }, [itemId]);

  const fetchBookedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('start_date, end_date')
        .eq('item_id', itemId)
        .in('status', ['pending', 'approved', 'active']);

      if (error) throw error;

      const dates: Date[] = [];
      data?.forEach((rental) => {
        const start = new Date(rental.start_date);
        const end = new Date(rental.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d));
        }
      });
      setBookedDates(dates);
    } catch (error) {
      console.error('Failed to fetch booked dates:', error);
    }
  };

  const isDateBooked = (date: Date) => {
    return bookedDates.some(
      (bookedDate) =>
        bookedDate.getFullYear() === date.getFullYear() &&
        bookedDate.getMonth() === date.getMonth() &&
        bookedDate.getDate() === date.getDate()
    );
  };

  return (
    <Popover modal={isMobile}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-12 justify-start text-left font-normal",
            !dateRange && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "LLL dd, y")} -{" "}
                {format(dateRange.to, "LLL dd, y")}
              </>
            ) : (
              format(dateRange.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        {/* Quick Dates */}
        <div className="flex gap-2 p-3 border-b">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDateRange({ from: today, to: today })}
            className="flex-1"
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDateRange({ from: tomorrow, to: tomorrow })}
            className="flex-1"
          >
            Tomorrow
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDateRange({ from: today, to: addDays(today, 6) })}
            className="flex-1"
          >
            Week
          </Button>
        </div>

        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={setDateRange}
          numberOfMonths={isMobile ? 1 : 2}
          disabled={(date) => date < new Date() || isDateBooked(date)}
          className="rounded-md"
          modifiers={{
            booked: bookedDates
          }}
          modifiersClassNames={{
            booked: "line-through opacity-50"
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
