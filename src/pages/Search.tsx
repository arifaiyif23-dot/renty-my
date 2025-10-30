import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Item, ItemCategory } from '@/types';
import ItemCard from '@/components/ItemCard';
import SkeletonCard from '@/components/SkeletonCard';
import EmptyState from '@/components/EmptyState';
import SEO from '@/components/SEO';
import { useDebounce } from '@/hooks/use-debounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search as SearchIcon, X, ArrowUpDown, Package, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Header from '@/components/Header';
import MobileFilterDrawer from '@/components/MobileFilterDrawer';
import { AdvancedSearchFilters } from '@/components/AdvancedSearchFilters';
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

export default function Search() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [userLocation, setUserLocation] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [itemCondition, setItemCondition] = useState<string>('all');
  const [maxDistance, setMaxDistance] = useState(50);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    await fetchItems();
    toast.success('Results refreshed');
  }, isMobile);

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

  useEffect(() => {
    fetchItems();
  }, [debouncedSearchQuery, category, minPrice, maxPrice, dateRange, userLocation, sortBy, verifiedOnly, instantBookOnly, itemCondition]);

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

      if (debouncedSearchQuery) {
        query = query.or(`title.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`);
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

      if (verifiedOnly) {
        query = query.eq('owner.is_verified', true);
      }

      if (instantBookOnly) {
        query = query.eq('instant_book_enabled', true);
      }

      if (itemCondition !== 'all') {
        query = query.eq('item_condition', itemCondition);
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

  const activeFiltersCount = [
    searchQuery,
    category !== 'all',
    minPrice,
    maxPrice,
    dateRange?.from,
    userLocation,
  ].filter(Boolean).length;

  return (
    <>
      <SEO
        title="Search Items"
        description="Browse and search thousands of items available for rent across Malaysia. Find vehicles, gadgets, tools, and more."
      />
      <Header />
      
      {/* Pull to Refresh Indicator */}
      {isMobile && pullDistance > 0 && (
        <div 
          className="fixed top-14 left-0 right-0 flex justify-center items-center z-40 transition-all"
          style={{ 
            transform: `translateY(${Math.min(pullDistance - 20, 60)}px)`,
            opacity: Math.min(pullDistance / 80, 1)
          }}
        >
          <div className="bg-card rounded-full p-2 shadow-lg border">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}

      <div className="container mx-auto p-4 pb-mobile-nav">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Search Items</h1>

        {/* Mobile: Search + Sort + Filter Button */}
        {isMobile ? (
          <div className="space-y-3 mb-6">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
                aria-label="Search items"
              />
            </div>

            <div className="flex gap-2">
              <MobileFilterDrawer
                category={category}
                setCategory={setCategory}
                minPrice={minPrice}
                setMinPrice={setMinPrice}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
                dateRange={dateRange}
                setDateRange={setDateRange}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
                activeFiltersCount={activeFiltersCount}
              />

              <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 h-12">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Advanced
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <AdvancedSearchFilters
                    verifiedOnly={verifiedOnly}
                    setVerifiedOnly={setVerifiedOnly}
                    instantBookOnly={instantBookOnly}
                    setInstantBookOnly={setInstantBookOnly}
                    itemCondition={itemCondition}
                    setItemCondition={setItemCondition}
                    maxDistance={maxDistance}
                    setMaxDistance={setMaxDistance}
                    showDistanceFilter={!!userLocation}
                  />
                </PopoverContent>
              </Popover>
              
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="flex-1 h-12">
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
          </div>
        ) : (
          /* Desktop: Full Filters */
          <div className="space-y-4 mb-6">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-2 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  aria-label="Search items"
                />
              </div>

              <Input
                placeholder="Location"
                value={userLocation}
                onChange={(e) => setUserLocation(e.target.value)}
                aria-label="Filter by location"
              />

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

            <div className="flex gap-3">
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

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Advanced
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <AdvancedSearchFilters
                    verifiedOnly={verifiedOnly}
                    setVerifiedOnly={setVerifiedOnly}
                    instantBookOnly={instantBookOnly}
                    setInstantBookOnly={setInstantBookOnly}
                    itemCondition={itemCondition}
                    setItemCondition={setItemCondition}
                    maxDistance={maxDistance}
                    setMaxDistance={setMaxDistance}
                    showDistanceFilter={!!userLocation}
                  />
                </PopoverContent>
              </Popover>
              
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
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
          </div>
        )}

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
