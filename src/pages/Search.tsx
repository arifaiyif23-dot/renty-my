import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { ItemCategory } from '@/types';
import { ListingCardV2 } from '@/components/marketplace/ListingCardV2';
import { SearchBarV2 } from '@/components/SearchBarV2';
import { EmptyStateV2 } from '@/components/EmptyStateV2';
import { SkeletonV2 } from '@/components/SkeletonV2';
import { GlassCard } from '@/components/ui/GlassCard';
import SEO from '@/components/SEO';
import { useDebounce } from '@/hooks/use-debounce';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, ArrowUpDown, SlidersHorizontal, RefreshCw, SearchSlash, BookmarkPlus, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import Header from '@/components/Header';
import { ScrollToTop } from '@/components/ScrollToTop';
import { AdvancedSearchFilters } from '@/components/AdvancedSearchFilters';
import { useVoiceSearch } from '@/hooks/use-voice-search';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getVerifiedUserIds } from '@/utils/verifiedFilter';
import { toast } from 'sonner';
import { MALAYSIA_STATES } from '@/components/SearchBarV2';

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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const persisted = (typeof window !== 'undefined') ? loadFilters() : {};
  const [category, setCategory] = useState<ItemCategory | 'all'>((persisted.category as ItemCategory | 'all') || 'all');
  const [minPrice, setMinPrice] = useState(persisted.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(persisted.maxPrice || '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [userLocation, setUserLocation] = useState<string>(persisted.userLocation || '');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>((persisted.sortBy as 'newest' | 'price_low' | 'price_high') || 'newest');
  const [verifiedOnly, setVerifiedOnly] = useState(!!persisted.verifiedOnly);
  const [instantBookOnly, setInstantBookOnly] = useState(!!persisted.instantBookOnly);
  const [itemCondition, setItemCondition] = useState<string>(persisted.itemCondition || 'all');
  const [maxDistance, setMaxDistance] = useState(persisted.maxDistance ?? 50);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { isListening, transcript } = useVoiceSearch();

  useEffect(() => {
    const payload: PersistedFilters = {
      category, minPrice, maxPrice, userLocation, sortBy,
      verifiedOnly, instantBookOnly, itemCondition, maxDistance,
    };
    try { localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(payload)); } catch { /* skip */ }
  }, [category, minPrice, maxPrice, userLocation, sortBy, verifiedOnly, instantBookOnly, itemCondition, maxDistance]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {
      localStorage.removeItem('recentSearches');
    }
  }, []);

  useEffect(() => {
    if (transcript && !isListening) {
      setSearchQuery(transcript);
      saveSearch(transcript);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, isListening]);

  const saveSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const fetchItemsPage = async (page: number, pageSize: number) => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const buildFilterQuery = (selectIdOnly = false) => {
      let q = supabase
        .from('items')
        .select(selectIdOnly ? 'id' : `
          id,
          title,
          price_per_day,
          category,
          location,
          owner:owner_id (
            is_verified,
            verification_level
          ),
          images:item_images (
            image_url
          )
        `)
        .eq('is_available', true);

      if (!selectIdOnly) q = (q as ReturnType<typeof q>).range(start, end);

      if (debouncedSearchQuery) {
        const sanitized = debouncedSearchQuery.replace(/[,()%]/g, '');
        q = q.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
      }

      if (category !== 'all') q = q.eq('category', category);
      if (minPrice) q = q.gte('price_per_day', parseFloat(minPrice));
      if (maxPrice) q = q.lte('price_per_day', parseFloat(maxPrice));
      // 'all' is the "All Malaysia" sentinel — never send it to the DB.
      if (userLocation && userLocation !== 'all') q = q.ilike('location', `%${userLocation}%`);

      const applyCommonFilters = (query: typeof q) => {
        if (instantBookOnly) query = query.eq('instant_book_enabled', true);
        if (itemCondition !== 'all') query = query.eq('item_condition', itemCondition);
        return query;
      };

      if (verifiedOnly) {
        return getVerifiedUserIds().then(ids => {
          q = ids.length > 0 ? q.in('owner_id', ids) : q.in('owner_id', [-1]);
          q = applyCommonFilters(q);
          if (!selectIdOnly) {
            if (sortBy === 'price_low') q = q.order('price_per_day', { ascending: true });
            else if (sortBy === 'price_high') q = q.order('price_per_day', { ascending: false });
            else q = q.order('created_at', { ascending: false });
          }
          return q;
        });
      }

      q = applyCommonFilters(q);

      if (!selectIdOnly) {
        if (sortBy === 'price_low') q = q.order('price_per_day', { ascending: true });
        else if (sortBy === 'price_high') q = q.order('price_per_day', { ascending: false });
        else q = q.order('created_at', { ascending: false });
      }

      return Promise.resolve(q);
    };

    const isOverlapping = (from: Date, to: Date, rental: { start_date: string; end_date: string }) => {
      const rStart = new Date(rental.start_date);
      const rEnd = new Date(rental.end_date);
      return (from >= rStart && from <= rEnd) ||
        (to >= rStart && to <= rEnd) ||
        (from <= rStart && to >= rEnd);
    };

    if (dateRange?.from && dateRange?.to) {
      const idQuery = await buildFilterQuery(true);
      idQuery.limit(5000);
      const { data: allIds, error: idError } = await idQuery;
      if (idError) throw idError;
      if (!allIds?.length) return [];

      const { data: rentals } = await supabase
        .from('rentals')
        .select('item_id, start_date, end_date')
        .in('item_id', allIds.map(i => i.id))
        .in('status', ['pending_approval', 'approved', 'paid', 'active']);

      const rentedIds = new Set<string>();
      rentals?.forEach(r => {
        if (isOverlapping(dateRange.from!, dateRange.to!, r)) {
          rentedIds.add(r.item_id);
        }
      });

      const availableIds = allIds.filter(i => !rentedIds.has(i.id)).map(i => i.id);
      const pageIds = availableIds.slice(start, end + 1);
      if (!pageIds.length) return [];

      const itemsQuery = supabase
        .from('items')
        .select(`
          id, title, price_per_day, category, location,
          owner:owner_id (is_verified, verification_level),
          images:item_images (image_url)
        `)
        .in('id', pageIds);
      if (sortBy === 'price_low') itemsQuery.order('price_per_day', { ascending: true });
      else if (sortBy === 'price_high') itemsQuery.order('price_per_day', { ascending: false });
      else itemsQuery.order('created_at', { ascending: false });

      const { data: items } = await itemsQuery;
      return items || [];
    }

    const query = await buildFilterQuery(false);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const { items, loading, hasMore, error, setSentinelRef, reset } = useInfiniteScroll({
    fetchFunction: fetchItemsPage,
    pageSize: 12,
  });

  useEffect(() => {
    reset();
    setInitialLoading(true);
  }, [debouncedSearchQuery, category, minPrice, maxPrice, dateRange, userLocation, sortBy, verifiedOnly, instantBookOnly, itemCondition, reset]);

  // Clear the initial-loading flag once the first fetch settles — whether it
  // returned items OR came back empty — so the empty state (not skeletons) shows.
  useEffect(() => {
    if (!loading && initialLoading) {
      setInitialLoading(false);
    }
  }, [loading, initialLoading]);

  useEffect(() => {
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const location = searchParams.get('location');
    const categoryParam = searchParams.get('category');

    if (startDate && endDate) {
      setDateRange({ from: new Date(startDate), to: new Date(endDate) });
    }
    if (location) {
      setUserLocation(location);
    }
    if (categoryParam) {
      setCategory(categoryParam as ItemCategory | 'all');
    }
  }, [searchParams]);

  useEffect(() => {
    setInitialLoading(false);
  }, []);

  const activeFiltersCount = [
    searchQuery, category !== 'all', minPrice, maxPrice, dateRange?.from, (userLocation && userLocation !== 'all') ? userLocation : '',
  ].filter(Boolean).length;

  const CATEGORY_OPTIONS = [
    { value: 'all', label: 'All Categories' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'vehicles', label: 'Vehicles' },
    { value: 'tools', label: 'Tools' },
    { value: 'sports', label: 'Sports' },
    { value: 'party', label: 'Party' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <>
      <SEO
        title="Search Items — RENTY"
        description="Browse thousands of items available for rent across Malaysia. Find vehicles, gadgets, tools, and more."
      />
      <Header />

      <div className="container mx-auto px-4 py-6 pb-mobile-nav">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Search</h1>
          <span className="text-sm text-muted-foreground">
            {loading ? 'Searching...' : `${items.length} items`}
          </span>
        </div>

        {/* Search Bar */}
        <div className="mb-5">
          <SearchBarV2 variant="inline" onSearch={(q) => saveSearch(q)} />
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Recent:</span>
            {recentSearches.map((search) => (
              <button
                key={search}
                onClick={() => { setSearchQuery(search); saveSearch(search); }}
                className="px-3 py-1.5 min-h-[36px] text-xs rounded-full bg-muted hover:bg-muted/80 transition-colors font-medium"
              >
                {search}
              </button>
            ))}
          </div>
        )}

        {/* Filters Row — selects share one row evenly on mobile */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Category Select */}
          <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory | 'all')}>
            <SelectTrigger className="flex-1 min-w-0 sm:flex-none sm:w-auto h-10 sm:min-w-[130px] rounded-xl bg-white border border-border shadow-1">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Location Select */}
          <Select value={userLocation} onValueChange={setUserLocation}>
            <SelectTrigger className="flex-1 min-w-0 sm:flex-none sm:w-auto h-10 sm:min-w-[130px] rounded-xl bg-white border border-border shadow-1">
              <MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Malaysia</SelectItem>
              {MALAYSIA_STATES.map((state) => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v: 'newest' | 'price_low' | 'price_high') => setSortBy(v)}>
            <SelectTrigger className="flex-1 min-w-0 sm:flex-none sm:w-auto h-10 sm:min-w-[130px] rounded-xl bg-white border border-border shadow-1">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Advanced Filters */}
          <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 rounded-xl border border-border shadow-1">
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="ml-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="start">
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

          {/* Save Search */}
          {user && (searchQuery || category !== 'all' || userLocation) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10"
              onClick={async () => {
                try {
                  const { error } = await supabase.from('saved_searches').insert({
                    user_id: user.id,
                    query_text: searchQuery || null,
                    category: category !== 'all' ? category : null,
                    location: userLocation || null,
                    min_price: minPrice ? parseFloat(minPrice) : null,
                    max_price: maxPrice ? parseFloat(maxPrice) : null,
                    sort_by: sortBy,
                    label: searchQuery || `${category !== 'all' ? category : 'all'} items`,
                    notify_on_new: false,
                  });
                  if (error) throw error;
                  toast.success('Search saved!');
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : 'Failed to save search');
                }
              }}
            >
              <BookmarkPlus className="h-4 w-4 mr-1" />
              Save
            </Button>
          )}
        </div>

        {/* Active Filter Chips */}
        {(searchQuery || category !== 'all' || minPrice || maxPrice || dateRange || userLocation) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1 rounded-full">
                {searchQuery}
                <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')} className="-m-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {category !== 'all' && (
              <Badge variant="secondary" className="gap-1 rounded-full">
                {category}
                <button type="button" aria-label="Clear category" onClick={() => setCategory('all')} className="-m-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {minPrice && (
              <Badge variant="secondary" className="gap-1 rounded-full">
                Min RM{minPrice}
                <button type="button" aria-label="Clear minimum price" onClick={() => setMinPrice('')} className="-m-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {maxPrice && (
              <Badge variant="secondary" className="gap-1 rounded-full">
                Max RM{maxPrice}
                <button type="button" aria-label="Clear maximum price" onClick={() => setMaxPrice('')} className="-m-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {userLocation && userLocation !== 'all' && (
              <Badge variant="secondary" className="gap-1 rounded-full">
                <MapPin className="h-3 w-3" />
                {userLocation}
                <button type="button" aria-label="Clear location" onClick={() => setUserLocation('')} className="-m-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {dateRange?.from && dateRange?.to && (
              <Badge variant="secondary" className="gap-1 rounded-full">
                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                <button type="button" aria-label="Clear date range" onClick={() => setDateRange(undefined)} className="-m-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setCategory('all');
                setMinPrice('');
                setMaxPrice('');
                setUserLocation('');
                setDateRange(undefined);
              }}
              className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results */}
        {error ? (
          <GlassCard variant="subtle" padding="lg" className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <SearchSlash className="h-7 w-7 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </GlassCard>
        ) : initialLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 md:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <SkeletonV2 variant="rectangular" className="aspect-[4/3]" />
                <div className="p-4 space-y-3">
                  <SkeletonV2 variant="text" className="h-4 w-3/4" />
                  <SkeletonV2 variant="text" className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center">
            <EmptyStateV2
              icon={SearchSlash}
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
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Browse categories:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['electronics', 'vehicles', 'tools', 'sports', 'party', 'fashion'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat as ItemCategory)}
                    className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors capitalize"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 md:gap-5">
            {items.map((item) => (
              <ListingCardV2
                key={item.id}
                id={item.id}
                title={item.title}
                image={item.images?.[0]?.image_url || '/placeholder.svg'}
                pricePerDay={Number(item.price_per_day)}
                category={item.category}
                location={item.location}
                badges={item.owner?.verification_level && item.owner.verification_level !== 'unverified' ? ['verified'] : undefined}
              />
            ))}
          </div>
        )}

        <div ref={setSentinelRef} className="h-10 w-full" />

        {loading && hasMore && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
      <ScrollToTop />
    </>
  );
}
