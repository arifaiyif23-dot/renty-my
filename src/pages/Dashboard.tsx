import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { RentalCard } from '@/components/RentalCard';
import { IncomingRequests } from '@/components/IncomingRequests';
import { Clock, Calendar as CalendarIcon, GitBranch, PackageSearch, RefreshCw } from 'lucide-react';
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
import EmptyState from '@/components/EmptyState';
import DashboardSkeleton from '@/components/DashboardSkeleton';
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
  const [loading, setLoading] = useState(true);
  const [selectedRentals, setSelectedRentals] = useState<Set<string>>(new Set());
  const [selectedRentalTimeline, setSelectedRentalTimeline] = useState<Rental | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const { activeTab, setTab, swipeHandlers } = useSwipeTabs({
    tabs: [...DASHBOARD_TABS],
    initialTab: 'active',
  });

  useEffect(() => {
    if (user) {
      fetchRentals();
    }
  }, [user]);

  const fetchRentals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          item:items(*),
          renter:profiles!rentals_renter_id_fkey(*),
          owner:profiles!rentals_owner_id_fkey(*)
        `)
        .or(`renter_id.eq.${user?.id},owner_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRentals((data || []) as Rental[]);
    } catch (error: unknown) {
      toast.error('Failed to load rentals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Pull-to-refresh hook
  const { isRefreshing, pullDistance } = usePullToRefresh(fetchRentals);

  const updateRentalStatus = async (rentalId: string, status: Rental['status']) => {
    const rental = rentals.find(r => r.id === rentalId);
    if (!rental) throw new Error('Rental not found');

    const { error } = await supabase
      .from('rentals')
      .update({ status })
      .eq('id', rentalId);

    if (error) throw error;
    
    fetchRentals();
  };

  const filterRentals = (status: string[]) => {
    return rentals.filter(r => status.includes(r.status));
  };

  const toggleRentalSelection = (rentalId: string) => {
    setSelectedRentals(prev => {
      const next = new Set(prev);
      if (next.has(rentalId)) {
        next.delete(rentalId);
      } else {
        next.add(rentalId);
      }
      return next;
    });
  };

  const handleBulkComplete = async () => {
    const ids = Array.from(selectedRentals);
    const results = await Promise.allSettled(
      ids.map((rentalId) => updateRentalStatus(rentalId, 'completed'))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    setSelectedRentals(new Set());
    if (succeeded > 0) toast.success(`${succeeded} rental(s) marked as completed`);
    if (failed > 0) toast.error(`${failed} rental(s) failed to update`);
  };

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedRentals);
    const results = await Promise.allSettled(
      ids.map((rentalId) => updateRentalStatus(rentalId, 'cancelled'))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    setSelectedRentals(new Set());
    if (succeeded > 0) toast.success(`${succeeded} rental(s) cancelled`);
    if (failed > 0) toast.error(`${failed} rental(s) failed to cancel`);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 pb-20 md:pb-4">
          <h1 className="text-3xl font-bold text-foreground mb-6">{t('dashboard.myRentals')}</h1>
          <DashboardSkeleton />
        </div>
      </>
    );
  }

  const activeCount = filterRentals(['paid', 'active']).length;
  const pendingCount = filterRentals(['pending_approval', 'approved']).length;
  const pastCount = filterRentals(['completed', 'cancelled', 'rejected']).length;

  // Show empty state if no rentals
  if (!loading && rentals.length === 0) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 pb-20 md:pb-4">
          <h1 className="text-3xl font-bold text-foreground mb-6">{t('dashboard.myRentals')}</h1>
          <EmptyState
            icon={PackageSearch}
            title={t('dashboard.noRentals')}
            description={t('dashboard.noRentalsDesc')}
            actionLabel={t('dashboard.browseItems')}
            onAction={() => navigate('/search')}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed top-16 left-0 right-0 z-40 flex justify-center transition-all duration-200"
          style={{ 
            transform: `translateY(${Math.min(pullDistance / 2, 40)}px)`,
            opacity: Math.min(pullDistance / 80, 1) 
          }}
        >
          <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}

      <div className="container mx-auto p-4 pb-20 md:pb-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard.myRentals')}</h1>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {activeCount} {t('dashboard.active')}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              {pendingCount} {t('dashboard.pending')}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalendar(true)}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              {t('dashboard.calendarView')}
            </Button>
          </div>
        </div>

        {/* Incoming Requests for Owners */}
        {rentals.some(r => r.status === 'pending_approval' && r.owner_id === user?.id) && (
          <div className="mb-6">
            <IncomingRequests 
              rentals={rentals.filter(r => r.owner_id === user?.id)} 
              onUpdate={fetchRentals} 
            />
          </div>
        )}
      
      <Tabs value={activeTab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-muted/20 w-full justify-start">
          <TabsTrigger value="active" className="flex-1 data-[state=active]:bg-card data-[state=active]:text-foreground">{t('dashboard.active')}</TabsTrigger>
          <TabsTrigger value="pending" className="flex-1 data-[state=active]:bg-card data-[state=active]:text-foreground">{t('dashboard.pending')}</TabsTrigger>
          <TabsTrigger value="past" className="flex-1 data-[state=active]:bg-card data-[state=active]:text-foreground">{t('dashboard.past')}</TabsTrigger>
        </TabsList>
        
        <div {...(isMobile ? swipeHandlers : {})} className="touch-pan-y">
        <TabsContent value="active" className="space-y-4 mt-4">
          {filterRentals(['paid', 'active']).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('dashboard.noActiveRentals')}</p>
          ) : filterRentals(['paid', 'active']).map(rental => (
            <div key={rental.id} className="relative">
              <div className="absolute left-4 top-4 z-10">
                <Checkbox
                  checked={selectedRentals.has(rental.id)}
                  onCheckedChange={() => toggleRentalSelection(rental.id)}
                  className="bg-card"
                />
              </div>
              <RentalCard 
                rental={rental}
                isOwner={rental.owner_id === user?.id}
                onStatusUpdate={updateRentalStatus}
                onReviewSuccess={fetchRentals}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRentalTimeline(rental)}
                className="mt-2"
              >
                <GitBranch className="h-4 w-4 mr-2" />
                {t('dashboard.viewTimeline')}
              </Button>
            </div>
          ))}
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4 mt-4">
          {filterRentals(['pending_approval', 'approved']).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('dashboard.noPendingRentals')}</p>
          ) : filterRentals(['pending_approval', 'approved']).map(rental => (
            <RentalCard 
              key={rental.id} 
              rental={rental}
              isOwner={rental.owner_id === user?.id}
              onStatusUpdate={updateRentalStatus}
              onReviewSuccess={fetchRentals}
            />
          ))}
        </TabsContent>
        
        <TabsContent value="past" className="space-y-4 mt-4">
          {filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('dashboard.noPastRentals')}</p>
          ) : filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).map(rental => (
            <RentalCard 
              key={rental.id} 
              rental={rental}
              isOwner={rental.owner_id === user?.id}
              onStatusUpdate={updateRentalStatus}
              onReviewSuccess={fetchRentals}
            />
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

      {/* Timeline Dialog */}
      <Dialog open={!!selectedRentalTimeline} onOpenChange={() => setSelectedRentalTimeline(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('dashboard.rentalTimeline')}</DialogTitle>
          </DialogHeader>
          {selectedRentalTimeline && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedRentalTimeline.item?.title || 'Item'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RentalTimeline rental={selectedRentalTimeline} />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Calendar Dialog */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('dashboard.rentalCalendar')}</DialogTitle>
          </DialogHeader>
          <RentalCalendarView rentals={rentals} />
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
