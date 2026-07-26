import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Rental } from '@/types';
import type { ModificationRequestData } from '@/components/ModificationRequests';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { ScrollToTop } from '@/components/ScrollToTop';
import { RentalCard } from '@/components/RentalCard';
import { IncomingRequests } from '@/components/IncomingRequests';
import { ModificationRequests } from '@/components/ModificationRequests';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonV2 } from '@/components/SkeletonV2';
import { EmptyStateV2 } from '@/components/EmptyStateV2';
import { Clock, Calendar as CalendarIcon, PackageSearch, RefreshCw, TrendingUp, Package, DollarSign } from 'lucide-react';
import { RentalTimeline } from '@/components/RentalTimeline';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { RentalCalendarView } from '@/components/RentalCalendarView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useSwipeTabs } from '@/hooks/use-swipe-tabs';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

const DASHBOARD_TABS = ['active', 'pending', 'past'] as const;

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [modifications, setModifications] = useState<ModificationRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRentals, setSelectedRentals] = useState<Set<string>>(new Set());
  const [selectedRentalTimeline, setSelectedRentalTimeline] = useState<Rental | null>(null);
  const [timelineModifications, setTimelineModifications] = useState<ModificationRequestData[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [stats, setStats] = useState({ totalRevenue: 0, activeRentals: 0, pendingRequests: 0, myListings: 0, rating: 0 });

  const { activeTab, setTab, swipeHandlers } = useSwipeTabs({
    tabs: [...DASHBOARD_TABS],
    initialTab: 'active',
  });

  useEffect(() => {
    if (user) {
      fetchRentals();
      fetchStats();
      fetchModifications();
    }
  }, [user, fetchRentals, fetchStats, fetchModifications]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const [rentalsData, itemsCount, reviewsData] = await Promise.all([
        supabase.from('rentals').select('total_price, status').or(`owner_id.eq.${user.id},renter_id.eq.${user.id}`),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
        supabase.from('reviews').select('rating').eq('reviewee_id', user.id),
      ]);

      const activeRentals = (rentalsData.data || []).filter(r => ['paid', 'active'].includes(r.status)).length;
      const pendingRequests = (rentalsData.data || []).filter(r => r.status === 'pending_approval' && r.owner_id === user.id).length;
      const totalRevenue = (rentalsData.data || [])
        .filter(r => r.status === 'completed' && r.owner_id === user.id)
        .reduce((sum, r) => sum + Number(r.total_price || 0), 0);

      const ratings = reviewsData.data || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

      setStats({
        totalRevenue,
        activeRentals,
        pendingRequests,
        myListings: itemsCount.count || 0,
        rating: Math.round(avgRating * 10) / 10,
      });
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      toast.error(t('dashboard.failedToLoadStats'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchRentals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          id, status, start_date, end_date, total_price, original_total_price, discount_amount, promo_code_id, owner_id, renter_id, pickup_code, dispute_reason, handover_photos, return_photos, created_at,
          item:items(id, title, category, images:item_images(image_url)),
          renter:profiles!rentals_renter_id_fkey(full_name, avatar_url),
          owner:profiles!rentals_owner_id_fkey(full_name, avatar_url)
        `)
        .or(`renter_id.eq.${user?.id},owner_id.eq.${user?.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRentals((data || []) as Rental[]);
    } catch {
      toast.error('Failed to load rentals');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchModifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data: ownedRentals } = await supabase
        .from('rentals')
        .select('id')
        .eq('owner_id', user.id);
      const ownedIds = (ownedRentals || []).map(r => r.id);
      if (ownedIds.length === 0) { setModifications([]); return; }

      const { data, error } = await supabase
        .from('rental_modifications')
        .select(`
          id, type, status, original_end_date, new_end_date, price_adjustment, reason, requested_at,
          rental:rentals!rental_id(id, item:items(title), renter:profiles!rentals_renter_id_fkey(full_name, avatar_url))
        `)
        .eq('status', 'pending')
        .in('rental_id', ownedIds);
      if (error) throw error;
      setModifications((data || []) as unknown as ModificationRequestData[]);
    } catch {
      console.error('Failed to fetch modifications');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchRentalModifications = useCallback(async (rentalId: string) => {
    const { data } = await supabase
      .from('rental_modifications')
      .select('*')
      .eq('rental_id', rentalId)
      .order('requested_at', { ascending: true });
    if (data) {
      const { data: rentals } = await supabase
        .from('rentals')
        .select('id, item:items(title), renter:profiles!rentals_renter_id_fkey(full_name, avatar_url)')
        .eq('id', rentalId)
        .single();
      setTimelineModifications((data || []).map(m => ({ ...m, rental: rentals })) as unknown as ModificationRequestData[]);
    }
  }, []);

  useEffect(() => {
    if (selectedRentalTimeline) {
      fetchRentalModifications(selectedRentalTimeline.id);
    } else {
      setTimelineModifications([]);
    }
  }, [selectedRentalTimeline, fetchRentalModifications]);

  const { isRefreshing, pullDistance } = usePullToRefresh(fetchRentals);

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending_approval: ['approved', 'rejected', 'cancelled'],
    approved: ['active', 'cancelled'],
    active: ['completed', 'disputed'],
    paid: ['active', 'completed', 'cancelled'],
  };

  const updateRentalStatus = async (rentalId: string, status: Rental['status']) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) throw new Error('Rental not found');
    if (!ALLOWED_TRANSITIONS[rental.status]?.includes(status)) {
      throw new Error(`Cannot change rental from '${rental.status}' to '${status}'`);
    }
    const { error } = await supabase.from('rentals').update({ status }).eq('id', rentalId);
    if (error) throw error;
    fetchRentals();
  };

  const filterRentals = (status: string[]) => rentals.filter(r => status.includes(r.status));

  const toggleRentalSelection = (rentalId: string) => {
    setSelectedRentals(prev => {
      const next = new Set(prev);
      if (next.has(rentalId)) { next.delete(rentalId); } else { next.add(rentalId); }
      return next;
    });
  };

  const handleBulkComplete = async () => {
    const ids = Array.from(selectedRentals);
    const results = await Promise.allSettled(ids.map((id) => updateRentalStatus(id, 'completed')));
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    setSelectedRentals(new Set());
    if (succeeded > 0) toast.success(`${succeeded} rental(s) marked as completed`);
  };

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedRentals);
    const results = await Promise.allSettled(ids.map((id) => updateRentalStatus(id, 'cancelled')));
    setSelectedRentals(new Set());
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    if (succeeded > 0) toast.success(`${succeeded} rental(s) cancelled`);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 pb-20 md:pb-4">
          <SkeletonV2 variant="text" className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <SkeletonV2 key={i} variant="card" className="h-24" />)}
          </div>
          <SkeletonV2 variant="card" className="h-48" />
        </div>
      </>
    );
  }

  const activeCount = filterRentals(['paid', 'active']).length;
  const pendingCount = filterRentals(['pending_approval', 'approved']).length;
  const pastCount = filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).length;

  if (!loading && rentals.length === 0) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 pb-20 md:pb-4">
          <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
          <EmptyStateV2
            icon={PackageSearch}
            title="No Rentals Yet"
            description="Start exploring items to rent or list your own"
            actionLabel="Browse Items"
            onAction={() => navigate('/search')}
          />
        </div>
      </>
    );
  }

  const userRentals = rentals.filter(r => r.owner_id === user?.id);
  const pendingModRentalIds = new Set(modifications.filter(m => m.status === 'pending').map(m => m.rental.id));

  return (
    <>
      <Header />

      {(pullDistance > 0 || isRefreshing) && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center transition-all duration-200"
          style={{ transform: `translateY(${Math.min(pullDistance / 2, 40)}px)`, opacity: Math.min(pullDistance / 80, 1) }}
        >
          <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}

      <div className="container mx-auto p-4 pb-20 md:pb-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1 rounded-full">
              <Clock className="h-3 w-3" />
              {activeCount} Active
            </Badge>
            <Button variant="outline" size="sm" className="rounded-xl h-9" onClick={() => setShowCalendar(true)}>
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              Calendar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Revenue</p>
              <p className="text-lg font-bold tabular-nums">RM{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Active</p>
              <p className="text-lg font-bold tabular-nums">{stats.activeRentals}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Pending</p>
              <p className="text-lg font-bold tabular-nums">{stats.pendingRequests}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Listings</p>
              <p className="text-lg font-bold tabular-nums">{stats.myListings}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </GlassCard>
        </div>

        {userRentals.some(r => r.status === 'pending_approval') && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Incoming Requests</h2>
            <IncomingRequests rentals={userRentals} onUpdate={fetchRentals} />
          </div>
        )}

        {modifications.length > 0 && (
          <div className="mb-6">
            <ModificationRequests modifications={modifications} onUpdate={fetchModifications} />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-muted/30 p-1 rounded-xl w-full justify-start gap-1">
            {(['active', 'pending', 'past'] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-1 data-[state=active]:text-foreground text-muted-foreground font-medium"
              >
                {t(`dashboard.${tab}`)}
                <Badge variant="outline" className="ml-1.5 rounded-full text-[10px] px-1.5 py-0 h-4 min-w-[18px] tabular-nums">
                  {tab === 'active' ? activeCount : tab === 'pending' ? pendingCount : pastCount}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <div {...(isMobile ? swipeHandlers : {})} className="touch-pan-y">
            <TabsContent value="active" className="space-y-3 mt-4">
              {filterRentals(['paid', 'active']).length === 0 ? (
                <EmptyStateV2
                  icon={PackageSearch}
                  title={t('dashboard.noActiveRentals')}
                  description={t('dashboard.noActiveRentalsDesc')}
                  variant="compact"
                />
              ) : filterRentals(['paid', 'active']).map(rental => (
                  <div key={rental.id} className="relative">
                    <div className="absolute left-3 top-3 z-10">
                      <Checkbox checked={selectedRentals.has(rental.id)} onCheckedChange={() => toggleRentalSelection(rental.id)} className="bg-card border-border" />
                    </div>
                    <RentalCard
                      rental={rental}
                      isOwner={rental.owner_id === user?.id}
                      onStatusUpdate={updateRentalStatus}
                      onReviewSuccess={fetchRentals}
                      hasPendingModification={pendingModRentalIds.has(rental.id)}
                      onShowTimeline={(r) => setSelectedRentalTimeline(r)}
                    />
                  </div>
              ))}
            </TabsContent>

            <TabsContent value="pending" className="space-y-3 mt-4">
              {filterRentals(['pending_approval', 'approved']).length === 0 ? (
                <EmptyStateV2
                  icon={Clock}
                  title={t('dashboard.noPendingRentals')}
                  description={t('dashboard.noPendingRentalsDesc')}
                  variant="compact"
                />
              ) : filterRentals(['pending_approval', 'approved']).map(rental => (
                <RentalCard key={rental.id} rental={rental} isOwner={rental.owner_id === user?.id} onStatusUpdate={updateRentalStatus} onReviewSuccess={fetchRentals} hasPendingModification={pendingModRentalIds.has(rental.id)} onShowTimeline={(r) => setSelectedRentalTimeline(r)} />
              ))}
            </TabsContent>

            <TabsContent value="past" className="space-y-3 mt-4">
              {filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).length === 0 ? (
                <EmptyStateV2
                  icon={Calendar as React.ComponentType<{ className?: string }>}
                  title={t('dashboard.noPastRentals')}
                  description={t('dashboard.noPastRentalsDesc')}
                  variant="compact"
                />
              ) : filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).map(rental => (
                <RentalCard key={rental.id} rental={rental} isOwner={rental.owner_id === user?.id} onStatusUpdate={updateRentalStatus} onReviewSuccess={fetchRentals} hasPendingModification={pendingModRentalIds.has(rental.id)} onShowTimeline={(r) => setSelectedRentalTimeline(r)} />
              ))}
            </TabsContent>
          </div>
        </Tabs>

        <BulkActionsBar
          selectedCount={selectedRentals.size}
          onClearSelection={() => setSelectedRentals(new Set())}
          onBulkComplete={handleBulkComplete}
          onBulkCancel={handleBulkCancel}
          showComplete={true}
          showCancel={true}
        />

        <Dialog open={!!selectedRentalTimeline} onOpenChange={() => setSelectedRentalTimeline(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Rental Timeline</DialogTitle>
            </DialogHeader>
            {selectedRentalTimeline && (
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">{selectedRentalTimeline.item?.title || 'Item'}</CardTitle></CardHeader>
                  <CardContent><RentalTimeline rental={selectedRentalTimeline} modifications={timelineModifications} /></CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Rental Calendar</DialogTitle></DialogHeader>
            <RentalCalendarView rentals={rentals} />
          </DialogContent>
        </Dialog>
      </div>
      <ScrollToTop />
    </>
  );
}
