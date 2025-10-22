import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Item, ItemCategory } from '@/types';
import ItemCard from '@/components/ItemCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, Calendar as CalendarIcon, X, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';
import { toast } from 'sonner';

export default function Search() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [userLocation, setUserLocation] = useState<string>('');
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const location = searchParams.get('location');
    
    if (startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    }
    if (location) {
      setUserLocation(location);
    }
  }, [searchParams]);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use reverse geocoding to get location name
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          const locationName = data.address.city || data.address.town || data.address.village || 'Your location';
          setUserLocation(locationName);
          toast.success(`Location set to ${locationName}`);
        } catch (error) {
          toast.error('Failed to get location name');
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        setGettingLocation(false);
        toast.error('Unable to get your location');
        console.error(error);
      }
    );
  };

  useEffect(() => {
    fetchItems();
  }, [searchQuery, category, minPrice, maxPrice, dateRange, userLocation]);

  const fetchItems = async () => {
    try {
      let query = supabase
        .from('items')
        .select(`
          *,
          owner:profiles(*),
          images:item_images(*)
        `)
        .eq('is_available', true);

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (userLocation) {
        query = query.ilike('location', `%${userLocation}%`);
      }

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (minPrice) {
        query = query.gte('price_per_day', parseFloat(minPrice));
      }

      if (maxPrice) {
        query = query.lte('price_per_day', parseFloat(maxPrice));
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      let filteredItems = data || [];

      // Filter by date availability
      if (dateRange?.from && dateRange?.to) {
        const { data: bookedRentals } = await supabase
          .from('rentals')
          .select('item_id')
          .in('status', ['approved', 'active'])
          .lte('start_date', format(dateRange.to, 'yyyy-MM-dd'))
          .gte('end_date', format(dateRange.from, 'yyyy-MM-dd'));

        const bookedItemIds = bookedRentals?.map(r => r.item_id) || [];
        filteredItems = filteredItems.filter(item => !bookedItemIds.includes(item.id));
      }

      setItems(filteredItems);
    } catch (error: any) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pb-mobile-nav">
        <h1 className="text-3xl font-bold mb-6">Search Items</h1>

        <div className="grid md:grid-cols-5 gap-4 mb-6">
          <div className="md:col-span-2 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="relative">
            <Input
              placeholder="Location"
              value={userLocation}
              onChange={(e) => setUserLocation(e.target.value)}
              className="pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={getUserLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div>
            <Select value={category} onValueChange={(value) => setCategory(value as ItemCategory | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="vehicles">Vehicles</SelectItem>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="party">Party</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal w-full">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                ) : (
                  format(dateRange.from, "MMM d")
                )
              ) : (
                "Select dates"
              )}
              {dateRange?.from && (
                <X
                  className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateRange(undefined);
                  }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              disabled={(date) => date < new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Min RM"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              type="number"
              placeholder="Max RM"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

      {dateRange?.from && dateRange?.to && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing items available from {format(dateRange.from, "MMM d, yyyy")} to {format(dateRange.to, "MMM d, yyyy")}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No items found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              id={item.id}
              title={item.title}
              image={item.images?.[0]?.image_url || '/placeholder.svg'}
              pricePerDay={item.price_per_day}
              category={item.category}
              rating={4.5}
              reviewCount={0}
              location={item.location}
            />
          ))}
        </div>
      )}
      </div>
    </>
  );
}
