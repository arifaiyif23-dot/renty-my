import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { ItemCategory } from '@/types';
import { ListingCard } from '@/components/ListingCard';
import { SearchBarV2 } from '@/components/SearchBarV2';
import { SkeletonV2 } from '@/components/SkeletonV2';
import SEO from '@/components/SEO';
import { PageLayout } from '@/components/PageLayout';
import { useDebounce } from '@/hooks/use-debounce';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ArrowUpDown, SearchSlash, MapPin, BookmarkPlus, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { ScrollToTop } from '@/components/ScrollToTop';
import { AdvancedSearchFilters } from '@/components/AdvancedSearchFilters';
import { MobileFilterDrawer } from '@/components/MobileFilterDrawer';
import { AuroraEmptyState } from '@/components/AuroraEmptyState';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getVerifiedUserIds } from '@/utils/verifiedFilter';
import { toast } from 'sonner';
import { MALAYSIA_STATES } from '@/components/SearchBarV2';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

const CATEGORY_OPTIONS = [
  { value: 'all', labelKey: 'search.all' },
  { value: 'electronics', labelKey: 'search.electronics' },
  { value: 'vehicles', labelKey: 'search.vehicles' },
  { value: 'tools', labelKey: 'search.tools' },
  { value: 'sports', labelKey: 'search.sports' },
  { value: 'party', labelKey: 'search.party' },
  { value: 'fashion', labelKey: 'search.fashion' },
  { value: 'other', labelKey: 'search.other' },
];

export default function Search() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [userLocation, setUserLocation] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [instantBookOnly, setInstantBookOnly] = useState(false);
  const [itemCondition, setItemCondition] = useState('all');
  const [maxDistance, setMaxDistance] = useState(50);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {
      localStorage.removeItem('recentSearches');
    }
  }, []);

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
        .eq('status', 'available');

      if (!selectIdOnly) q = (q as ReturnType<typeof q>).range(start, end);

      if (debouncedSearchQuery) {
        const sanitized = debouncedSearchQuery.replace(/[,()%]/g, '');
        q = q.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
      }

      if (category !== 'all') q = q.eq('category', category);
      if (minPrice) q = q.gte('price_per_day', parseFloat(minPrice));
      if (maxPrice) q = q.lte('price_per_day', parseFloat(maxPrice));
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
        .in('status', ['requested', 'payment_pending', 'reserved', 'confirmed', 'active']);

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

  const { isRefreshing, pullDistance } = usePullToRefresh(async () => {
    reset();
    setInitialLoading(true);
  });

  useEffect(() => {
    reset();
    setInitialLoading(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [debouncedSearchQuery, category, minPrice, maxPrice, dateRange, userLocation, sortBy, verifiedOnly, instantBookOnly, itemCondition, reset]);

  useEffect(() => {
    if (!loading && initialLoading) {
      setInitialLoading(false);
    }
  }, [loading, initialLoading]);

  useEffect(() => {
    const q = searchParams.get('q');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const location = searchParams.get('location');
    const categoryParam = searchParams.get('category');

    if (q !== null) setSearchQuery(q);
    if (startDate && endDate) setDateRange({ from: new Date(startDate), to: new Date(endDate) });
    if (location) setUserLocation(location);
    if (categoryParam) setCategory(categoryParam as ItemCategory | 'all');
  }, [searchParams]);

  useEffect(() => {
    setInitialLoading(false);
  }, []);

  const saveSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const activeFiltersCount = [
    searchQuery, category !== 'all', minPrice, maxPrice, dateRange?.from, (userLocation && userLocation !== 'all') ? userLocation : '',
  ].filter(Boolean).length;

  return (
    <PageLayout>
      {pullDistance > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pointer-events-none">
          <div
            className="bg-primary text-primary-foreground rounded-full p-2 shadow-3"
            style={{ transform: `rotate(${pullDistance * 2}deg)`, opacity: Math.min(pullDistance / 80, 1) }}
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}
      <SEO
        title="Search — RENTY"
        description="Browse thousands of items available for rent across Malaysia."
      />

      <div className="lg:flex lg:gap-6">
        <aside className="hidden lg:block w-72 shrink-0 space-y-6">
          <div className="card-base p-5 sticky top-24 space-y-6">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-4">Filters</h3>
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
            </div>
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => {
                  setVerifiedOnly(false); setInstantBookOnly(false);
                  setItemCondition('all'); setMaxDistance(25);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
        {/* Mobile needs its own search bar; desktop uses the navbar's inline search */}
        <div className="mb-5 lg:hidden">
          <SearchBarV2 variant="inline" onSearch={(q) => saveSearch(q)} />
        </div>

        {recentSearches.length > 0 && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {recentSearches.map((search) => (
              <button
                key={search}
                onClick={() => { setSearchQuery(search); saveSearch(search); }}
                className="px-2.5 py-1 text-xs rounded-full bg-muted hover:bg-muted/80 transition-colors min-h-[44px]"
              >
                {search}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory | 'all')}>
            <SelectTrigger className="h-10 text-xs min-w-0 flex-1 rounded-lg">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={userLocation} onValueChange={setUserLocation}>
            <SelectTrigger data-testid="search-location" className="h-10 text-xs min-w-0 flex-1 rounded-lg">
              <MapPin className="h-3 w-3 mr-1 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Malaysia</SelectItem>
              {MALAYSIA_STATES.map((state) => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v: 'newest' | 'price_low' | 'price_high') => setSortBy(v)}>
            <SelectTrigger className="h-10 text-xs min-w-0 flex-1 rounded-lg">
              <ArrowUpDown className="h-3 w-3 mr-1 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_low">Low Price</SelectItem>
              <SelectItem value="price_high">High Price</SelectItem>
            </SelectContent>
          </Select>

          <div className="lg:hidden">
          <MobileFilterDrawer activeFiltersCount={activeFiltersCount}>
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
          </MobileFilterDrawer>
          </div>

          {user && (searchQuery || category !== 'all' || userLocation) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg"
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
              <BookmarkPlus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {(searchQuery || category !== 'all' || minPrice || maxPrice || dateRange || userLocation) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {searchQuery && (
              <Badge variant="outline" className="gap-1 rounded-full text-[11px] min-h-[44px]">
                {searchQuery}
                <button type="button" onClick={() => setSearchQuery('')} className="-my-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5" aria-label={`Remove search: ${searchQuery}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {category !== 'all' && (
              <Badge variant="outline" className="gap-1 rounded-full text-[11px] min-h-[44px]">
                {category}
                <button type="button" onClick={() => setCategory('all')} className="-my-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5" aria-label={`Remove category: ${category}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {minPrice && (
              <Badge variant="outline" className="gap-1 rounded-full text-[11px] min-h-[44px]">
                Min RM{minPrice}
                <button type="button" onClick={() => setMinPrice('')} className="-my-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5" aria-label={`Remove minimum price: RM${minPrice}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {maxPrice && (
              <Badge variant="outline" className="gap-1 rounded-full text-[11px] min-h-[44px]">
                Max RM{maxPrice}
                <button type="button" onClick={() => setMaxPrice('')} className="-my-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5" aria-label={`Remove maximum price: RM${maxPrice}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {userLocation && userLocation !== 'all' && (
              <Badge variant="outline" className="gap-1 rounded-full text-[11px] min-h-[44px]">
                {userLocation}
                <button type="button" onClick={() => setUserLocation('')} className="-my-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5" aria-label={`Remove location: ${userLocation}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {dateRange?.from && dateRange?.to && (
              <Badge variant="outline" className="gap-1 rounded-full text-[11px] min-h-[44px]">
                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                <button type="button" onClick={() => setDateRange(undefined)} className="-my-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5" aria-label="Remove date range">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button
              onClick={() => {
                setSearchQuery(''); setCategory('all'); setMinPrice(''); setMaxPrice('');
                setUserLocation(''); setDateRange(undefined);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground px-1.5"
            >
              Clear
            </button>
          </div>
        )}

        {error ? (
          <div className="card-base p-8 text-center">
            <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <SearchSlash className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="font-semibold mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={reset}>
              Try Again
            </Button>
          </div>
        ) : initialLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-border">
                <SkeletonV2 variant="rectangular" className="aspect-golden" />
                <div className="p-3 space-y-2">
                  <SkeletonV2 variant="text" className="h-4 w-3/4" />
                  <SkeletonV2 variant="text" className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <AuroraEmptyState
            icon={SearchSlash}
            title="No items found"
            description="Try adjusting your filters or search terms."
            actionLabel="Clear Filters"
            onAction={() => { setSearchQuery(''); setCategory('all'); setMinPrice(''); setMaxPrice(''); setUserLocation(''); setDateRange(undefined); }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <ListingCard
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

        <div ref={setSentinelRef} className="h-8 w-full" />

        {loading && hasMore && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      </div>
      <ScrollToTop />
    </PageLayout>
  );
}
