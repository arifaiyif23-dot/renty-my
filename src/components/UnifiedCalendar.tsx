import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface UnifiedCalendarProps {
  itemId: string;
  mode: "view" | "select";
  dateRange?: DateRange | undefined;
  setDateRange?: (range: DateRange | undefined) => void;
  onDateSelect?: (range: DateRange | undefined) => void;
}

export function UnifiedCalendar({ 
  itemId, 
  mode,
  dateRange,
  setDateRange,
  onDateSelect
}: UnifiedCalendarProps) {
  const isMobile = useIsMobile();
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (itemId) {
      fetchBookedDates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const fetchBookedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('start_date, end_date')
        .eq('item_id', itemId)
        .in('status', ['requested', 'payment_pending', 'reserved', 'confirmed', 'active', 'disputed']);

      if (error) throw error;

      const dates: Date[] = [];
      (data || []).forEach((rental) => {
        const start = new Date(rental.start_date);
        const end = new Date(rental.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d));
        }
      });
      setBookedDates(dates);
    } catch (error) {
      console.error('Failed to fetch booked dates:', error);
    } finally {
      setLoading(false);
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

  // VIEW MODE - Card with calendar
  if (mode === "view") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Availability Calendar
            <Badge variant="secondary">Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 bg-muted rounded-lg animate-pulse" />
          ) : (
            <>
              <Calendar
                mode="single"
                disabled={(date) => date < new Date() || isDateBooked(date)}
                modifiers={{
                  booked: bookedDates,
                }}
                modifiersClassNames={{
                  booked: 'bg-destructive/20 text-destructive line-through',
                }}
                className="rounded-lg border"
              />
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive/20" />
                  <span>Booked</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // SELECT MODE - Popover with range picker
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
            <span>Select your rental dates</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        {/* Quick Dates */}
        <div className="flex gap-2 p-3 border-b">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const range = { from: today, to: today };
              setDateRange?.(range);
              onDateSelect?.(range);
            }}
            className="flex-1"
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const range = { from: tomorrow, to: tomorrow };
              setDateRange?.(range);
              onDateSelect?.(range);
            }}
            className="flex-1"
          >
            Tomorrow
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const range = { from: today, to: addDays(today, 6) };
              setDateRange?.(range);
              onDateSelect?.(range);
            }}
            className="flex-1"
          >
            Week
          </Button>
        </div>

        {loading ? (
          <div className="h-64 bg-muted rounded-lg animate-pulse m-3" />
        ) : (
          <>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange?.(range);
                onDateSelect?.(range);
              }}
              numberOfMonths={isMobile ? 1 : 2}
              disabled={(date) => date < new Date() || isDateBooked(date)}
              modifiers={{
                booked: bookedDates
              }}
              modifiersClassNames={{
                booked: "line-through opacity-50 bg-destructive/20"
              }}
              className="rounded-lg pointer-events-auto"
            />
            <div className="flex gap-4 p-3 text-sm border-t">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive/20" />
                <span>Booked</span>
              </div>
              {dateRange && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary/60" />
                  <span>Your Selection</span>
                </div>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}