import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AvailabilityCalendarProps {
  itemId: string;
}

export const AvailabilityCalendar = ({ itemId }: AvailabilityCalendarProps) => {
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookedDates();
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
      (data || []).forEach(rental => {
        const start = new Date(rental.start_date);
        const end = new Date(rental.end_date);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d));
        }
      });

      setBookedDates(dates);
    } catch (error) {
      console.error('Error fetching booked dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDateBooked = (date: Date) => {
    return bookedDates.some(
      bookedDate =>
        bookedDate.getDate() === date.getDate() &&
        bookedDate.getMonth() === date.getMonth() &&
        bookedDate.getFullYear() === date.getFullYear()
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Availability
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
              className="rounded-md border"
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
};
