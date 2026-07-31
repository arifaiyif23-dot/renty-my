import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rental } from '@/types';

interface RentalCalendarViewProps {
  rentals: Rental[];
}

export function RentalCalendarView({ rentals }: RentalCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const getRentalsForDate = (date: Date) => {
    return rentals.filter(rental => {
      const start = new Date(rental.start_date);
      const end = new Date(rental.end_date);
      return isWithinInterval(date, { start, end });
    });
  };

  const selectedDateRentals = selectedDate ? getRentalsForDate(selectedDate) : [];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calendar View</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-lg border"
            modifiers={{
              hasRentals: (date) => getRentalsForDate(date).length > 0,
              activeRental: (date) => getRentalsForDate(date).some(r => r.status === 'active' || r.status === 'confirmed'),
              pendingRental: (date) => getRentalsForDate(date).some(r => r.status === 'requested' || r.status === 'reserved'),
            }}
            modifiersClassNames={{
              hasRentals: 'font-bold',
              activeRental: 'bg-primary/20 hover:bg-primary/30',
              pendingRental: 'bg-secondary/20 hover:bg-secondary/30',
            }}
          />
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded bg-primary/20" />
              <span className="text-muted-foreground">Active rentals</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded bg-secondary/20" />
              <span className="text-muted-foreground">Pending rentals</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedDate && `Rentals on ${selectedDate.toLocaleDateString()}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateRentals.length > 0 ? (
            <div className="space-y-3">
              {selectedDateRentals.map((rental) => (
                <div key={rental.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium truncate">{rental.item?.title || 'Item'}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(rental.start_date).toLocaleDateString()} - {new Date(rental.end_date).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={rental.status === 'active' ? 'default' : 'secondary'} className="flex-shrink-0">
                      {rental.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rentals on this date
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
