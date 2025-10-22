import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Item, ItemCategory } from '@/types';
import ItemCard from '@/components/ItemCard';
import SkeletonCard from '@/components/SkeletonCard';
import EmptyState from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, Calendar as CalendarIcon, X, MapPin, Loader2, ArrowUpDown, Package } from 'lucide-react';
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
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');

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
  }, [searchQuery, category, minPrice, maxPrice, dateRange, userLocation, sortBy]);

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

      // Apply sorting
      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'price_low') {
        query = query.order('price_per_day', { ascending: true });
      } else if (sortBy === 'price_high') {
        query = query.order('price_per_day', { ascending: false });
      }

      const { data, error } = await query;

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
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Search Items</h1>

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

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 flex-1">
            <Input
              type="number"
              placeholder="Min RM"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Max RM"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="flex-1"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters */}
        {(searchQuery || category !== 'all' || minPrice || maxPrice || dateRange || userLocation) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {searchQuery && (
              <Badge variant="secondary" className="gap-2">
                Search: {searchQuery}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </Badge>
            )}
            {category !== 'all' && (
              <Badge variant="secondary" className="gap-2">
                Category: {category}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setCategory('all')} />
              </Badge>
            )}
            {minPrice && (
              <Badge variant="secondary" className="gap-2">
                Min: RM {minPrice}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setMinPrice('')} />
              </Badge>
            )}
            {maxPrice && (
              <Badge variant="secondary" className="gap-2">
                Max: RM {maxPrice}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setMaxPrice('')} />
              </Badge>
            )}
            {userLocation && (
              <Badge variant="secondary" className="gap-2">
                Location: {userLocation}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setUserLocation('')} />
              </Badge>
            )}
            {dateRange?.from && dateRange?.to && (
              <Badge variant="secondary" className="gap-2">
                Dates: {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setDateRange(undefined)} />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setCategory('all');
                setMinPrice('');
                setMaxPrice('');
                setUserLocation('');
                setDateRange(undefined);
              }}
              className="h-7 text-xs"
            >
              Clear All
            </Button>
          </div>
        )}

      {/* Results */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Searching...' : `${items.length} items found`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Items Found"
          description="Try adjusting your filters or search terms to find what you're looking for."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setCategory('all');
            setMinPrice('');
            setMaxPrice('');
            setUserLocation('');
            setDateRange(undefined);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              id={item.id}
              title={item.title}
              image={item.images?.[0]?.image_url || '/placeholder.svg'}
              pricePerDay={Number(item.price_per_day)}
              category={item.category}
              rating={0}
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
