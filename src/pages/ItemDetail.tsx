import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Item } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { MapPin, User } from 'lucide-react';
import { DateRange } from 'react-day-picker';

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    if (id) {
      fetchItem();
    }
  }, [id]);

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          owner:profiles(*),
          images:item_images(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
    } catch (error: any) {
      toast.error('Failed to load item');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!user) {
      toast.error('Please sign in to book');
      navigate('/auth');
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Please select dates');
      return;
    }

    setIsBooking(true);
    try {
      const days = differenceInDays(dateRange.to, dateRange.from) + 1;
      const totalPrice = days * (item?.price_per_day || 0);

      const { error } = await supabase
        .from('rentals')
        .insert({
          item_id: item?.id,
          renter_id: user.id,
          owner_id: item?.owner_id,
          start_date: dateRange.from.toISOString().split('T')[0],
          end_date: dateRange.to.toISOString().split('T')[0],
          total_price: totalPrice,
        });

      if (error) throw error;
      
      toast.success('Rental request sent!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
      console.error(error);
    } finally {
      setIsBooking(false);
    }
  };

  const calculatePrice = () => {
    if (!dateRange?.from || !dateRange?.to || !item) return 0;
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    return days * item.price_per_day;
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (!item) {
    return <div className="container mx-auto p-4">Item not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center">
            {item.images?.[0] ? (
              <img 
                src={item.images[0].image_url} 
                alt={item.title}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <p className="text-muted-foreground">No image</p>
            )}
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{item.title}</CardTitle>
                <Badge>{item.category}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{item.description}</p>
              
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{item.location}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span>{item.owner?.full_name}</span>
              </div>
              
              <div className="text-2xl font-bold">
                RM {item.price_per_day}/day
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Book this item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Dates</Label>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>

            {dateRange?.from && dateRange?.to && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{differenceInDays(dateRange.to, dateRange.from) + 1} days</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>RM {calculatePrice()}</span>
                </div>
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleBooking}
              disabled={!dateRange?.from || !dateRange?.to || isBooking}
            >
              {isBooking ? 'Booking...' : 'Request to Book'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
