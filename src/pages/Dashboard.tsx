import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Rental } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PageLayout } from "@/components/PageLayout";
import { ScrollToTop } from '@/components/ScrollToTop';
import { RentalCard } from '@/components/RentalCard';
import { IncomingRequests } from '@/components/IncomingRequests';
import { SkeletonV2 } from '@/components/SkeletonV2';
import { EmptyStateV2 } from '@/components/EmptyStateV2';
import { PackageSearch, DollarSign, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [stats, setStats] = useState({ totalRevenue: 0, activeRentals: 0, pendingRequests: 0 });

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const [rentalsData] = await Promise.all([
        supabase.from('rentals').select('total_price, status').or(`owner_id.eq.${user.id},renter_id.eq.${user.id}`),
      ]);
      const activeRentals = (rentalsData.data || []).filter(r => ['confirmed', 'active', 'overdue'].includes(r.status)).length;
      const pendingRequests = (rentalsData.data || []).filter(r => r.status === 'reserved' && r.owner_id === user.id).length;
      const totalRevenue = (rentalsData.data || []).filter(r => r.status === 'completed' && r.owner_id === user.id).reduce((sum, r) => sum + Number(r.total_price || 0), 0);
      setStats({ totalRevenue, activeRentals, pendingRequests });
    } catch { /* silent */ }
  }, [user]);

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
    } catch { toast.error('Failed to load rentals'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    if (user) { fetchRentals(); fetchStats(); }
  }, [user, fetchRentals, fetchStats]);

  const filterRentals = (statuses: string[]) => rentals.filter(r => statuses.includes(r.status));

  if (loading) {
    return (
      <PageLayout variant="default">
        <div className="">
          <SkeletonV2 variant="text" className="h-8 w-48 mb-6" />
          <SkeletonV2 variant="card" className="h-48" />
        </div>
      </PageLayout>
    );
  }

  if (!loading && rentals.length === 0) {
    return (
      <PageLayout variant="default">
          <h1 className="text-xl font-bold mb-6">My Rentals</h1>
          <EmptyStateV2 icon={PackageSearch} title="No rentals yet" description="Browse items to start renting." actionLabel="Browse Items" onAction={() => navigate('/search')} />
      </PageLayout>
    );
  }

  const activeCount = filterRentals(['confirmed', 'active', 'overdue']).length;
  const pendingCount = filterRentals(['requested', 'payment_pending', 'reserved']).length;
  const pastCount = filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).length;
  const userRentals = rentals.filter(r => r.owner_id === user?.id);

  return (
    <PageLayout variant="default">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold">My Rentals</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {stats.totalRevenue > 0 && (
              <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> RM{stats.totalRevenue.toLocaleString()}</span>
            )}
            <span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {stats.activeRentals} active</span>
            {stats.pendingRequests > 0 && <Badge variant="outline" className="rounded-full text-[11px]">{stats.pendingRequests} pending</Badge>}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted p-0.5 rounded-lg w-full justify-start gap-0.5 mb-4">
            {(['active', 'pending', 'past'] as const).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="flex-1 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-1 text-sm">
                {t(`dashboard.${tab}`)}
                <Badge variant="outline" className="ml-1.5 rounded-full text-[10px] px-1.5 py-0 h-4 min-w-[18px] tabular-nums">
                  {tab === 'active' ? activeCount : tab === 'pending' ? pendingCount : pastCount}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {filterRentals(['confirmed', 'active', 'overdue']).length === 0 ? (
              <EmptyStateV2 icon={PackageSearch} title="No active rentals" variant="compact" />
            ) : (
              filterRentals(['confirmed', 'active', 'overdue']).map(rental => (
                <RentalCard key={rental.id} rental={rental} isOwner={rental.owner_id === user?.id} onReviewSuccess={fetchRentals} />
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3">
            {userRentals.some(r => r.status === 'reserved') && (
              <div className="mb-4">
                <IncomingRequests rentals={userRentals} onUpdate={fetchRentals} />
              </div>
            )}
            {filterRentals(['requested', 'payment_pending', 'reserved']).length === 0 ? (
              <EmptyStateV2 icon={PackageSearch} title="No pending rentals" variant="compact" />
            ) : (
              filterRentals(['requested', 'payment_pending', 'reserved']).map(rental => (
                <RentalCard key={rental.id} rental={rental} isOwner={rental.owner_id === user?.id} onReviewSuccess={fetchRentals} />
              ))
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3">
            {filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).length === 0 ? (
              <EmptyStateV2 icon={PackageSearch} title="No past rentals" variant="compact" />
            ) : (
              filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).map(rental => (
                <RentalCard key={rental.id} rental={rental} isOwner={rental.owner_id === user?.id} onReviewSuccess={fetchRentals} />
              ))
            )}
          </TabsContent>
        </Tabs>
      <ScrollToTop />
    </PageLayout>
  );
}
