import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  DollarSign, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PaymentStat {
  totalRevenue: number;
  pendingPayments: number;
  platformFees: number;
  successRate: number;
}

interface PaymentData {
  id: string;
  amount: number;
  platform_fee: number;
  owner_earnings: number;
  status: string;
  paid_at: string;
  created_at: string;
  rental: {
    id: string;
    start_date: string;
    end_date: string;
    renter: {
      full_name: string;
    };
    item: {
      title: string;
      owner: {
        full_name: string;
      };
    };
  };
}

export default function AdminPayments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [stats, setStats] = useState<PaymentStat>({
    totalRevenue: 0,
    pendingPayments: 0,
    platformFees: 0,
    successRate: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    checkAdminAccess();
  }, [user, navigate]);

  const checkAdminAccess = async () => {
    const { data, error } = await supabase.functions.invoke('verify-admin');

    if (error || !data?.isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
      return;
    }

    fetchPayments();
    fetchStats();
  };

  const fetchPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        rental:rentals(
          id,
          start_date,
          end_date,
          renter:profiles!rentals_renter_id_fkey(full_name),
          item:items(
            title,
            owner:profiles!items_owner_id_fkey(full_name)
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error('Fetch payments error:', error);
      toast.error("Failed to fetch payments");
      setLoading(false);
      return;
    }

    setPayments(data || []);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("amount, platform_fee, status");

    const totalRevenue = paymentsData
      ?.filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const platformFees = paymentsData
      ?.filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.platform_fee), 0) || 0;

    const pendingCount = paymentsData?.filter(p => p.status === 'pending').length || 0;
    const completedCount = paymentsData?.filter(p => p.status === 'completed').length || 0;
    const totalCount = paymentsData?.length || 0;

    setStats({
      totalRevenue,
      pendingPayments: pendingCount,
      platformFees,
      successRate: totalCount ? (completedCount / totalCount) * 100 : 0,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: { variant: "default", icon: CheckCircle, color: "text-primary" },
      pending: { variant: "secondary", icon: Clock, color: "text-secondary" },
      failed: { variant: "destructive", icon: Clock, color: "text-destructive" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`w-3 h-3 ${config.color}`} />
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Payment Management</h1>
            <p className="text-muted-foreground">
              View all rental payments and platform statistics
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">RM {stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
                <p className="text-2xl font-bold">{stats.pendingPayments}</p>
              </div>
              <Clock className="w-8 h-8 text-secondary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform Fees</p>
                <p className="text-2xl font-bold">RM {stats.platformFees.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
          </Card>
        </div>

        {/* Payments List */}
        <Card>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Payments</h2>
            
            {loading ? (
              <div className="text-center py-12">Loading payments...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No payments found
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <Card key={payment.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Package className="w-5 h-5 text-muted-foreground" />
                          <h3 className="font-semibold">{payment.rental?.item?.title || 'Unknown Item'}</h3>
                          {getStatusBadge(payment.status)}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Renter</p>
                            <p className="font-medium">{payment.rental?.renter?.full_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Owner</p>
                            <p className="font-medium">{payment.rental?.item?.owner?.full_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Amount</p>
                            <p className="font-medium">RM {Number(payment.amount).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Owner Earnings</p>
                            <p className="font-medium text-primary">
                              RM {Number(payment.owner_earnings).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <span>Platform Fee: RM {Number(payment.platform_fee).toFixed(2)}</span>
                          {payment.rental && (
                            <>
                              <span>•</span>
                              <span>
                                Period: {payment.rental.start_date} to {payment.rental.end_date}
                              </span>
                            </>
                          )}
                          {payment.paid_at && (
                            <>
                              <span>•</span>
                              <span>
                                Paid: {new Date(payment.paid_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
