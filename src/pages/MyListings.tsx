import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Search, Grid3x3, List, Eye,
  Edit, Pause, Play, Trash2, MoreVertical,
  Calendar, DollarSign, Inbox, Loader2
} from 'lucide-react';
import EnhancedEmptyState from '@/components/EnhancedEmptyState';
import SkeletonCard from '@/components/SkeletonCard';
import { IncomingRequests } from '@/components/IncomingRequests';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ListingEditDialog } from '@/components/ListingEditDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GlassCard } from '@/components/ui/GlassCard';

type ViewMode = 'grid' | 'list';
type SortBy = 'recent' | 'views' | 'bookings' | 'revenue';
type StatusFilter = 'all' | 'active' | 'paused' | 'draft' | 'archived';

export default function MyListings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; bulk: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'requests'>('listings');

  const { data: items, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-listings', user?.id, statusFilter, sortBy],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('items')
        .select(`
          *,
          item_images (
            id,
            image_url,
            is_primary
          )
        `)
        .eq('owner_id', user.id);

      if (statusFilter !== 'all') {
        query = query.eq('listing_status', statusFilter);
      } else {
        query = query.or('listing_status.is.null,listing_status.neq.archived');
      }

      switch (sortBy) {
        case 'views':
          query = query.order('view_count', { ascending: false });
          break;
        case 'bookings':
          query = query.order('booking_count', { ascending: false });
          break;
        case 'recent':
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['listing-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, view_count, booking_count')
        .eq('owner_id', user.id)
        .eq('listing_status', 'active');

      if (itemsError) throw itemsError;

      const { data: rentals, error: rentalsError } = await supabase
        .from('rentals')
        .select('total_price')
        .eq('owner_id', user.id)
        .eq('status', 'completed');

      if (rentalsError) throw rentalsError;

      const totalViews = items?.reduce((sum, item) => sum + (item.view_count || 0), 0) || 0;
      const totalRevenue = rentals?.reduce((sum, r) => sum + Number(r.total_price), 0) || 0;

      return {
        totalListings: items?.length || 0,
        activeRentals: items?.filter(i => i.booking_count > 0).length || 0,
        totalRevenue,
        totalViews,
      };
    },
    enabled: !!user,
  });

  const { data: incomingRequests } = useQuery({
    queryKey: ['incoming-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          item:items(*),
          renter:profiles!rentals_renter_id_fkey(*)
        `)
        .eq('owner_id', user.id)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const { error } = await supabase
      .from('items')
      .update({ listing_status: newStatus })
      .eq('id', itemId);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('listings.updateSuccess'));
      refetch();
    }
  };

  const handleDelete = (itemId: string) => {
    setDeleteTarget({ ids: [itemId], bulk: false });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const { data: rentalRows, error: rentalError } = await supabase
        .from('rentals')
        .select('item_id')
        .in('item_id', deleteTarget.ids);

      if (rentalError) throw rentalError;

      const itemsWithHistory = new Set((rentalRows || []).map((rental) => rental.item_id));
      const archiveIds = deleteTarget.ids.filter((id) => itemsWithHistory.has(id));
      const deleteIds = deleteTarget.ids.filter((id) => !itemsWithHistory.has(id));

      if (archiveIds.length > 0) {
        const { error: archiveError } = await supabase
          .from('items')
          .update({ listing_status: 'archived', is_available: false })
          .in('id', archiveIds);

        if (archiveError) throw archiveError;
      }

      if (deleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('items')
          .delete()
          .in('id', deleteIds);

        if (deleteError) throw deleteError;
      }

      toast.success(
        archiveIds.length > 0
          ? 'Listing removed from marketplace. Rental history is kept safely.'
          : t('listings.deleteSuccess')
      );

      if (deleteTarget.bulk) setSelectedItems([]);
      refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleBulkAction = async (action: 'activate' | 'pause' | 'delete') => {
    if (selectedItems.length === 0) return;

    if (action === 'delete') {
      setDeleteTarget({ ids: selectedItems, bulk: true });
      return;
    }

    {
      const status = action === 'activate' ? 'active' : 'paused';
      const { error } = await supabase
        .from('items')
        .update({ listing_status: status })
        .in('id', selectedItems);

      if (!error) {
        toast.success(t('listings.updateSuccess'));
        setSelectedItems([]);
        refetch();
      }
    }
  };

  const filteredItems = items?.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'paused': return 'secondary';
      case 'draft': return 'outline';
      default: return 'destructive';
    }
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold">{t('listings.myListings')}</h1>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'listings' | 'requests')} className="mt-3 w-full">
                <TabsList className="grid grid-cols-2 md:inline-flex">
                  <TabsTrigger value="listings" className="text-sm">My Listings</TabsTrigger>
                  <TabsTrigger value="requests" className="gap-2 text-sm">
                    <Inbox className="h-4 w-4" />
                    <span className="truncate">Requests</span>
                    {incomingRequests && incomingRequests.length > 0 && (
                      <Badge variant="destructive" className="ml-1">{incomingRequests.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Button onClick={() => navigate('/list-item')} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {t('listings.createNew')}
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('listings.totalListings')}</p>
                  <p className="text-lg font-bold tabular-nums">{stats.totalListings}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Grid3x3 className="h-5 w-5 text-primary" />
                </div>
              </GlassCard>
              <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('listings.activeRentals')}</p>
                  <p className="text-lg font-bold tabular-nums">{stats.activeRentals}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-success" />
                </div>
              </GlassCard>
              <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('listings.totalRevenue')}</p>
                  <p className="text-lg font-bold tabular-nums">RM{stats.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-warning" />
                </div>
              </GlassCard>
              <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('listings.totalViews')}</p>
                  <p className="text-lg font-bold tabular-nums">{stats.totalViews}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-sky-500" />
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="w-full md:w-auto overflow-x-auto">
              <TabsList className="w-max min-w-full md:min-w-0 bg-muted/30 p-1 rounded-xl gap-1">
                <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">{t('common.all')}</TabsTrigger>
                <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">{t('common.active')}</TabsTrigger>
                <TabsTrigger value="paused" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">{t('common.paused')}</TabsTrigger>
                <TabsTrigger value="draft" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1">{t('common.draft')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-full md:w-[180px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('listings.mostRecent')}</SelectItem>
                <SelectItem value="views">{t('listings.mostViews')}</SelectItem>
                <SelectItem value="bookings">{t('listings.mostBookings')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-xl"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="rounded-xl"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="mt-4 p-3 bg-muted/50 backdrop-blur rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {selectedItems.length} {t('listings.itemsSelected')}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleBulkAction('activate')}>
                  <Play className="h-4 w-4 mr-2" />
                  {t('listings.activateAll')}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleBulkAction('pause')}>
                  <Pause className="h-4 w-4 mr-2" />
                  {t('listings.pauseAll')}
                </Button>
                <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => handleBulkAction('delete')}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('listings.deleteSelected')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {activeTab === 'listings' ? (
          isLoading ? (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            )}>
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <p className="text-destructive font-medium mb-2">Failed to load listings</p>
              <p className="text-sm text-muted-foreground mb-4">{error?.message || "An unexpected error occurred"}</p>
              <Button variant="outline" onClick={() => refetch()} className="rounded-xl">Try Again</Button>
            </div>
          ) : !filteredItems || filteredItems.length === 0 ? (
            <EnhancedEmptyState
              icon={List}
              title={t('listings.noListings')}
              description="Start earning by listing your first item. It only takes a few minutes to set up."
              actionLabel={t('listings.createNew')}
              onAction={() => navigate('/list-item')}
              secondaryActionLabel="Learn How It Works"
              onSecondaryAction={() => navigate('/#how-it-works')}
            />
          ) : (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            )}>
              {filteredItems.map((item: { id: string; title: string; item_images?: { image_url: string; is_primary: boolean }[] }) => {
              const primaryImage = item.item_images?.find((img) => img.is_primary);
              const imageUrl = primaryImage?.image_url || item.item_images?.[0]?.image_url;
              const isSelected = selectedItems.includes(item.id);

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "overflow-hidden transition-all border-border/70 shadow-sm hover:shadow-md rounded-2xl",
                    isSelected && "ring-2 ring-primary"
                  )}
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems([...selectedItems, item.id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item.id));
                        }
                      }}
                      className="absolute top-2 left-2 z-10 h-6 w-6 rounded border-background"
                    />
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={item.title}
                        className="w-full h-44 md:h-48 object-cover"
                      />
                    )}
                    <Badge
                      className="absolute top-2 right-2 rounded-full"
                      variant={getStatusBadgeVariant(item.listing_status)}
                    >
                      {t(`common.${item.listing_status}`)}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="font-semibold text-lg line-clamp-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 rounded-xl">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/items/${item.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t('listings.viewListing')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingItem(item)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('listings.editListing')}
                          </DropdownMenuItem>
                          {item.listing_status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleStatusChange(item.id, 'paused')}>
                              <Pause className="h-4 w-4 mr-2" />
                              {t('listings.pauseListing')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleStatusChange(item.id, 'active')}>
                              <Play className="h-4 w-4 mr-2" />
                              {t('listings.activateListing')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('listings.deleteListing')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
                      <div className="text-lg font-bold leading-none">
                        RM{item.price_per_day}/{t('common.per_day')}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {item.view_count || 0}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {item.booking_count || 0}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <IncomingRequests
          rentals={incomingRequests || []}
          onUpdate={() => {
            refetch();
          }}
        />
      )}
      </div>

      {editingItem && (
        <ListingEditDialog
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          listing={editingItem}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.bulk
                ? `Remove ${deleteTarget.ids.length} listings from marketplace?`
                : 'Remove this listing from marketplace?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>The listing will stop appearing in search and renters will not be able to request it.</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>If it has rental history, Renty keeps that history safely and archives the listing.</li>
                  <li>If it has no history, the listing and related photos/bookmarks are deleted.</li>
                  <li>Current rental records are preserved for receipts, disputes, and payouts.</li>
                </ul>
                <p className="font-medium text-foreground pt-2">
                  Tip: If you just want to stop receiving requests, pause the listing instead.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing...
                </span>
              ) : (
                'Remove listing'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
