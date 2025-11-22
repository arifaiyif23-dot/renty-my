import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Unlock, AlertTriangle, DollarSign, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import SEO from "@/components/SEO";
import BackButton from "@/components/BackButton";

interface EscrowAccount {
  id: string;
  rental_id: string;
  total_amount: number;
  platform_fee: number;
  owner_payout: number;
  status: string;
  held_at: string;
  auto_release_at: string | null;
  released_at: string | null;
  rental: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    owner_confirmed_completion: boolean;
    renter_confirmed_completion: boolean;
    renter: { full_name: string };
    owner: { full_name: string };
    item: { title: string };
  };
}

interface EscrowStats {
  total_held: number;
  total_released_today: number;
  pending_disputes: number;
  auto_release_ready: number;
}

export default function AdminEscrowManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [escrows, setEscrows] = useState<EscrowAccount[]>([]);
  const [stats, setStats] = useState<EscrowStats>({
    total_held: 0,
    total_released_today: 0,
    pending_disputes: 0,
    auto_release_ready: 0
  });
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-admin');
      if (error || !data?.isAdmin) {
        toast.error('Admin access required');
        navigate('/');
        return;
      }
      fetchEscrows();
      fetchStats();
    } catch (error) {
      console.error('Admin check error:', error);
      navigate('/');
    }
  };

  const fetchEscrows = async () => {
    try {
      const { data, error } = await supabase
        .from('escrow_accounts')
        .select(`
          *,
          rental:rentals!inner(
            id, status, start_date, end_date,
            owner_confirmed_completion, renter_confirmed_completion,
            renter:profiles!rentals_renter_id_fkey(full_name),
            owner:profiles!rentals_owner_id_fkey(full_name),
            item:items!inner(title)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEscrows(data || []);
    } catch (error) {
      console.error('Error fetching escrows:', error);
      toast.error('Failed to load escrow accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [heldResult, releasedResult, disputesResult] = await Promise.all([
        supabase
          .from('escrow_accounts')
          .select('total_amount')
          .eq('status', 'held'),
        supabase
          .from('escrow_accounts')
          .select('total_amount')
          .eq('status', 'released')
          .gte('released_at', today),
        supabase
          .from('disputes')
          .select('id')
          .in('status', ['open', 'investigating'])
      ]);

      const totalHeld = heldResult.data?.reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;
      const totalReleased = releasedResult.data?.reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;

      setStats({
        total_held: totalHeld,
        total_released_today: totalReleased,
        pending_disputes: disputesResult.data?.length || 0,
        auto_release_ready: 0 // TODO: Add query for auto-release eligible
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const runAutoRelease = async () => {
    setProcessing('auto-release');
    try {
      const { data, error } = await supabase.functions.invoke('auto-release-escrow');
      if (error) throw error;

      toast.success('Auto-release completed', {
        description: `Released ${data.released} of ${data.total_checked} eligible escrows`
      });
      
      fetchEscrows();
      fetchStats();
    } catch (error) {
      console.error('Auto-release error:', error);
      toast.error('Failed to run auto-release');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      held: { variant: "secondary", icon: Lock, label: "Held" },
      releasing: { variant: "default", icon: Clock, label: "Releasing" },
      released: { variant: "default", icon: CheckCircle2, label: "Released" },
      disputed: { variant: "destructive", icon: AlertTriangle, label: "Disputed" },
      refunded: { variant: "outline", icon: XCircle, label: "Refunded" },
      frozen: { variant: "destructive", icon: AlertTriangle, label: "Frozen" }
    };

    const config = variants[status] || variants.held;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filterEscrows = (status: string) => {
    if (status === 'all') return escrows;
    return escrows.filter(e => e.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Escrow Management - Admin"
        description="Manage escrow accounts and payment releases"
      />
      
      <div className="container mx-auto px-4 py-8">
        <BackButton />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Escrow Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage payment escrow accounts
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Held</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {stats.total_held.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">In escrow accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Released Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {stats.total_released_today.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Completed payouts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Disputes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending_disputes}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto-Release</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button
                onClick={runAutoRelease}
                disabled={processing === 'auto-release'}
                size="sm"
                className="w-full"
              >
                {processing === 'auto-release' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Unlock className="mr-2 h-4 w-4" />
                    Run Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Escrow List */}
        <Card>
          <CardHeader>
            <CardTitle>Escrow Accounts</CardTitle>
            <CardDescription>View and manage all escrow accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All ({escrows.length})</TabsTrigger>
                <TabsTrigger value="held">Held ({filterEscrows('held').length})</TabsTrigger>
                <TabsTrigger value="released">Released ({filterEscrows('released').length})</TabsTrigger>
                <TabsTrigger value="disputed">Disputed ({filterEscrows('disputed').length})</TabsTrigger>
                <TabsTrigger value="refunded">Refunded ({filterEscrows('refunded').length})</TabsTrigger>
              </TabsList>

              {['all', 'held', 'released', 'disputed', 'refunded'].map(tab => (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  {filterEscrows(tab).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No {tab !== 'all' ? tab : ''} escrow accounts found
                    </p>
                  ) : (
                    filterEscrows(tab).map((escrow) => (
                      <Card key={escrow.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="space-y-1">
                              <h3 className="font-semibold">{escrow.rental.item.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {escrow.rental.renter.full_name} → {escrow.rental.owner.full_name}
                              </p>
                            </div>
                            {getStatusBadge(escrow.status)}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Total Amount</p>
                              <p className="font-semibold">RM {escrow.total_amount.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Owner Payout</p>
                              <p className="font-semibold">RM {escrow.owner_payout.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Platform Fee</p>
                              <p className="font-semibold">RM {escrow.platform_fee.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Held Since</p>
                              <p className="font-semibold">
                                {formatDistanceToNow(new Date(escrow.held_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>

                          {escrow.auto_release_at && escrow.status === 'held' && (
                            <div className="mt-4 p-3 bg-muted rounded-lg">
                              <p className="text-sm">
                                <Clock className="inline h-4 w-4 mr-1" />
                                Auto-release scheduled: {formatDistanceToNow(new Date(escrow.auto_release_at), { addSuffix: true })}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}