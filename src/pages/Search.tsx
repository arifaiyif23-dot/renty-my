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
import { AutocompleteSearch } from '@/components/AutocompleteSearch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search as SearchIcon, X, ArrowUpDown, Package, RefreshCw, SlidersHorizontal, Mic, MicOff } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Header from '@/components/Header';
import MobileFilterDrawer from '@/components/MobileFilterDrawer';
import { AdvancedSearchFilters } from '@/components/AdvancedSearchFilters';
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useVoiceSearch } from '@/hooks/use-voice-search';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';

const FILTERS_STORAGE_KEY = 'renty:searchFilters:v1';

type PersistedFilters = {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  userLocation?: string;
  sortBy?: 'newest' | 'price_low' | 'price_high';
  verifiedOnly?: boolean;
  instantBookOnly?: boolean;
  itemCondition?: string;
  maxDistance?: number;
};

function loadFilters(): PersistedFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function Search() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const persisted = (typeof window !== 'undefined') ? loadFilters() : {};
  const [category, setCategory] = useState<ItemCategory | 'all'>((persisted.category as any) || 'all');
  const [minPrice, setMinPrice] = useState(persisted.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(persisted.maxPrice || '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [userLocation, setUserLocation] = useState<string>(persisted.userLocation || '');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>(persisted.sortBy || 'newest');
  const [verifiedOnly, setVerifiedOnly] = useState(!!persisted.verifiedOnly);
  const [instantBookOnly, setInstantBookOnly] = useState(!!persisted.instantBookOnly);
  const [itemCondition, setItemCondition] = useState<string>(persisted.itemCondition || 'all');
  const [maxDistance, setMaxDistance] = useState(persisted.maxDistance ?? 50);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { isListening, transcript, startListening, stopListening, isSupported } = useVoiceSearch();

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    const payload: PersistedFilters = {
      category, minPrice, maxPrice, userLocation, sortBy,
      verifiedOnly, instantBookOnly, itemCondition, maxDistance,
    };
    try { localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(payload)); } catch {}
  }, [category, minPrice, maxPrice, userLocation, sortBy, verifiedOnly, instantBookOnly, itemCondition, maxDistance]);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (transcript && !isListening) {
      setSearchQuery(transcript);
      saveSearch(transcript);
    }
  }, [transcript, isListening]);

  const saveSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Infinite scroll
  const fetchItemsPage = async (page: number, pageSize: number) => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase
      .from('items')
      .select(`
        id,
        title,
        price_per_day,
        category,
        location,
        owner:owner_id (
          is_verified
        ),
        images:item_images (
          image_url
        )
      `)
      .eq('is_available', true)
      .range(start, end);

    if (debouncedSearchQuery) {
      query = query.or(`title.ilike.%${debouncedSearchQuery}%,description.ilike.%${debouncedSearchQuery}%`);
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

    if (userLocation) {
      query = query.ilike('location', `%${userLocation}%`);
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

    if (sortBy === 'price_low') {
      query = query.order('price_per_day', { ascending: true });
    } else if (sortBy === 'price_high') {
      query = query.order('price_per_day', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    if (dateRange?.from && dateRange?.to) {
      const availableItems = [];
      for (const item of data || []) {
        const { data: rentals } = await supabase
          .from('rentals')
          .select('start_date, end_date')
          .eq('item_id', item.id)
          .in('status', ['pending_approval', 'approved', 'paid', 'active']);

        const isAvailable = !rentals?.some(rental => {
          const rentalStart = new Date(rental.start_date);
          const rentalEnd = new Date(rental.end_date);
          return (
            (dateRange.from! >= rentalStart && dateRange.from! <= rentalEnd) ||
            (dateRange.to! >= rentalStart && dateRange.to! <= rentalEnd) ||
            (dateRange.from! <= rentalStart && dateRange.to! >= rentalEnd)
          );
        });

        if (isAvailable) {
          availableItems.push(item);
        }
      }
      return availableItems;
    }

    return data || [];
  };

  const { items, loading, hasMore, sentinelRef, reset } = useInfiniteScroll({
    fetchFunction: fetchItemsPage,
    pageSize: 12,
  });

  // Reset infinite scroll when filters change
  useEffect(() => {
    reset();
    setInitialLoading(true);
    fetchItemsPage(1, 12).then(newItems => {
      // The hook will handle setting items
      setInitialLoading(false);
    });
  }, [debouncedSearchQuery, category, minPrice, maxPrice, dateRange, userLocation, sortBy, verifiedOnly, instantBookOnly, itemCondition, reset]);

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    reset();
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
    setInitialLoading(false);
  }, []);

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

        {/* Recent Searches */}
        {recentSearches.length > 0 && !loading && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">Recent searches:</p>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => { 
                    setSearchQuery(search);
                    saveSearch(search);
                  }}
                  className="px-3 py-1 text-sm rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile: Search + Sort + Filter Button */}
        {isMobile ? (
          <div className="space-y-3 mb-6">
            <div className="relative">
              <AutocompleteSearch
                value={searchQuery}
                onChange={setSearchQuery}
                onSelect={(value) => saveSearch(value)}
              />
              {isSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] ${isListening ? 'text-primary animate-pulse' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  aria-label={isListening ? "Stop voice search" : "Start voice search"}
                >
                  {isListening ? <MicOff className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
                </Button>
              )}
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
              <div className="md:col-span-2">
                <AutocompleteSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(value) => saveSearch(value)}
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
                  className="h-7 text-xs min-h-[44px]"
                  aria-label="Clear all filters"
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

      {initialLoading ? (
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
        
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-10 w-full" />
        
        {loading && hasMore && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </>
  );
}
