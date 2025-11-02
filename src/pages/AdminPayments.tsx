import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Users,
  Package
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PaymentData {
  rental: any;
  renter: any;
  owner: any;
  item: any;
  hold?: any;
}

export default function AdminPayments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    platformFees: 0,
    successRate: 0,
  });

  useEffect(() => {
    checkAdminAccess();
    fetchPayments();
    fetchStats();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    const { data: rentals, error } = await supabase
      .from("rentals")
      .select(`
        *,
        renter:profiles!rentals_renter_id_fkey(id, full_name, avatar_url),
        owner:profiles!rentals_owner_id_fkey(id, full_name, avatar_url),
        item:items(id, title, price_per_day)
      `)
      .in("status", ["completed", "active", "approved"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Failed to fetch payments");
      return;
    }

    const paymentsData: PaymentData[] = await Promise.all(
      (rentals || []).map(async (rental) => {
        const { data: hold } = await supabase
          .from("payment_holds")
          .select("*")
          .eq("rental_id", rental.id)
          .single();

        return {
          rental,
          renter: rental.renter,
          owner: rental.owner,
          item: rental.item,
          hold,
        };
      })
    );

    setPayments(paymentsData);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data: transactions } = await supabase
      .from("wallet_transactions")
      .select("amount, type");

    // Calculate platform fees as 10% of all rental earnings
    const rentalEarnings = transactions?.filter(
      (t) => t.type === "rental_earning"
    );

    const totalRevenue = transactions?.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    ) || 0;

    const platformFees = (rentalEarnings?.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    ) || 0) / 0.9 * 0.1; // Calculate 10% platform fee from owner earnings

    const { count: pendingCount } = await supabase
      .from("rentals")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "unpaid")
      .eq("status", "completed");

    const { count: totalCompleted } = await supabase
      .from("rentals")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: paidCount } = await supabase
      .from("rentals")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "paid")
      .eq("status", "completed");

    setStats({
      totalRevenue,
      pendingPayments: pendingCount || 0,
      platformFees,
      successRate: totalCompleted ? ((paidCount || 0) / totalCompleted) * 100 : 0,
    });
  };

  const releasePayment = async (rentalId: string) => {
    const { error } = await supabase.functions.invoke("process-rental-payment", {
      body: { rentalId },
    });

    if (error) {
      toast.error("Failed to release payment");
      return;
    }

    toast.success("Payment released successfully");
    fetchPayments();
    fetchStats();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: { variant: "default", icon: CheckCircle, color: "text-green-600" },
      unpaid: { variant: "secondary", icon: Clock, color: "text-yellow-600" },
      processing: { variant: "outline", icon: AlertCircle, color: "text-blue-600" },
    };

    const config = variants[status] || variants.unpaid;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`w-3 h-3 ${config.color}`} />
        {status}
      </Badge>
    );
  };

  const filterPayments = (filterType: string) => {
    switch (filterType) {
      case "pending":
        return payments.filter((p) => p.rental.payment_status === "unpaid");
      case "paid":
        return payments.filter((p) => p.rental.payment_status === "paid");
      case "held":
        return payments.filter((p) => p.hold && p.hold.status === "held");
      default:
        return payments;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Payment Management</h1>
            <p className="text-muted-foreground">
              Oversee all transactions and releases
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
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform Fees</p>
                <p className="text-2xl font-bold">RM {stats.platformFees.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
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

        {/* Payment List */}
        <Card>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b">
              <TabsTrigger value="all">All Payments</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="held">On Hold</TabsTrigger>
            </TabsList>

            {["all", "pending", "paid", "held"].map((tabValue) => (
              <TabsContent key={tabValue} value={tabValue} className="p-6">
                {loading ? (
                  <div className="text-center py-12">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    {filterPayments(tabValue).map((payment) => {
                      const platformFee = payment.rental.total_price * 0.1;
                      const ownerPayout = payment.rental.total_price - platformFee;

                      return (
                        <Card key={payment.rental.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Package className="w-5 h-5 text-muted-foreground" />
                                <h3 className="font-semibold">{payment.item?.title}</h3>
                                {getStatusBadge(payment.rental.payment_status)}
                                {payment.hold && (
                                  <Badge variant="destructive">Held</Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Renter</p>
                                  <p className="font-medium">{payment.renter?.full_name}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Owner</p>
                                  <p className="font-medium">{payment.owner?.full_name}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Total Price</p>
                                  <p className="font-medium">RM {Number(payment.rental.total_price).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Owner Payout</p>
                                  <p className="font-medium text-green-600">
                                    RM {ownerPayout.toFixed(2)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                <span>Platform Fee: RM {platformFee.toFixed(2)}</span>
                                <span>•</span>
                                <span>
                                  Rental Period: {payment.rental.start_date} to{" "}
                                  {payment.rental.end_date}
                                </span>
                              </div>

                              {payment.hold && (
                                <div className="mt-3 p-3 bg-destructive/10 rounded-lg">
                                  <p className="text-sm font-medium text-destructive">
                                    Hold Reason: {payment.hold.hold_reason}
                                  </p>
                                  {payment.hold.admin_notes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Notes: {payment.hold.admin_notes}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 ml-4">
                              {payment.rental.payment_status === "unpaid" &&
                                payment.rental.status === "completed" &&
                                payment.rental.renter_confirmed_completion &&
                                payment.rental.owner_confirmed_completion && (
                                  <Button
                                    size="sm"
                                    onClick={() => releasePayment(payment.rental.id)}
                                  >
                                    Release Payment
                                  </Button>
                                )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}

                    {filterPayments(tabValue).length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        No payments found
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
