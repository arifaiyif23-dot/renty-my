import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Search, Filter, Grid3x3, List, BarChart3, Eye, 
  Edit, Pause, Play, Copy, Trash2, MoreVertical, TrendingUp,
  Calendar, DollarSign, Star, Heart, Inbox
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
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
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'listings' | 'requests'>('listings');

  const { data: items, isLoading, refetch } = useQuery({
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
      
      const { data: items } = await supabase
        .from('items')
        .select('id, view_count, booking_count')
        .eq('owner_id', user.id)
        .eq('listing_status', 'active');

      const { data: rentals } = await supabase
        .from('rentals')
        .select('total_price')
        .eq('owner_id', user.id)
        .eq('status', 'completed');

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

  const handleDelete = async (itemId: string) => {
    if (!confirm(t('listings.confirmDelete'))) return;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('listings.deleteSuccess'));
      refetch();
    }
  };

  const handleBulkAction = async (action: 'activate' | 'pause' | 'delete') => {
    if (selectedItems.length === 0) return;

    if (action === 'delete' && !confirm(t('listings.confirmBulkDelete', { count: selectedItems.length }))) {
      return;
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('items')
        .delete()
        .in('id', selectedItems);

      if (!error) {
        toast.success(t('listings.deleteSuccess'));
        setSelectedItems([]);
        refetch();
      }
    } else {
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
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header - Non-sticky */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('listings.myListings')}</h1>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'listings' | 'requests')} className="mt-2">
                <TabsList>
                  <TabsTrigger value="listings">My Listings</TabsTrigger>
                  <TabsTrigger value="requests" className="gap-2">
                    <Inbox className="h-4 w-4" />
                    Incoming Requests
                    {incomingRequests && incomingRequests.length > 0 && (
                      <Badge variant="destructive" className="ml-1">{incomingRequests.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Button onClick={() => navigate('/list-item')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('listings.createNew')}
            </Button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <List className="h-4 w-4" />
                      <p className="text-xs font-medium">{t('listings.totalListings')}</p>
                    </div>
                    <p className="text-2xl font-bold">{stats.totalListings}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <p className="text-xs font-medium">{t('listings.activeRentals')}</p>
                    </div>
                    <p className="text-2xl font-bold">{stats.activeRentals}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <p className="text-xs font-medium">{t('listings.totalRevenue')}</p>
                    </div>
                    <p className="text-2xl font-bold">RM{stats.totalRevenue.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <p className="text-xs font-medium">{t('listings.totalViews')}</p>
                    </div>
                    <p className="text-2xl font-bold">{stats.totalViews}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Filters Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList>
                <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
                <TabsTrigger value="active">{t('common.active')}</TabsTrigger>
                <TabsTrigger value="paused">{t('common.paused')}</TabsTrigger>
                <TabsTrigger value="draft">{t('common.draft')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('listings.mostRecent')}</SelectItem>
                <SelectItem value="views">{t('listings.mostViews')}</SelectItem>
                <SelectItem value="bookings">{t('listings.mostBookings')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedItems.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {selectedItems.length} {t('listings.itemsSelected')}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('activate')}>
                  <Play className="h-4 w-4 mr-2" />
                  {t('listings.activateAll')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkAction('pause')}>
                  <Pause className="h-4 w-4 mr-2" />
                  {t('listings.pauseAll')}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleBulkAction('delete')}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('listings.deleteSelected')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
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
          ) : !filteredItems || filteredItems.length === 0 ? (
            <EmptyState
              icon={List}
              title={t('listings.noListings')}
              description={t('listings.noListingsDesc')}
              actionLabel={t('listings.createNew')}
              onAction={() => navigate('/list-item')}
            />
          ) : (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            )}>
              {filteredItems.map((item: any) => {
              const primaryImage = item.item_images?.find((img: any) => img.is_primary);
              const imageUrl = primaryImage?.image_url || item.item_images?.[0]?.image_url;
              const isSelected = selectedItems.includes(item.id);

              return (
                <Card 
                  key={item.id} 
                  className={cn(
                    "overflow-hidden transition-all hover:shadow-lg",
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
                      className="absolute top-2 left-2 z-10 h-5 w-5 rounded"
                    />
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={item.title}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <Badge 
                      className="absolute top-2 right-2"
                      variant={getStatusBadgeVariant(item.listing_status)}
                    >
                      {t(`common.${item.listing_status}`)}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg line-clamp-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-lg font-bold">
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
          rentals={(incomingRequests || []) as any} 
          onUpdate={() => {
            refetch();
          }} 
        />
      )}
      </div>

      {/* Edit Dialog */}
      {editingItem && (
        <ListingEditDialog
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          listing={editingItem}
        />
      )}
    </div>
  );
}
