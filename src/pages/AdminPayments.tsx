import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/components/AdminLayout";
import { format } from "date-fns";
import { CreditCard, Loader2, Filter } from "lucide-react";

interface AdminPayment {
  id: string;
  total_amount: number;
  rental_amount: number;
  platform_fee: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  rental: { id: string; status: string } | null;
  payouts: { status: string; payout_amount: number }[] | null;
}

interface AdminPayout {
  id: string;
  payout_amount: number;
  platform_fee: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  owner: { full_name: string } | null;
  payment: { total_amount: number; status: string } | null;
}

export default function AdminPayments() {
  const [activeTab, setActiveTab] = useState("transactions");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [payoutFilter, setPayoutFilter] = useState("all");
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalFees: 0,
    completedCount: 0,
    refundedCount: 0,
  });

  useEffect(() => {
    if (activeTab === "transactions") fetchPayments();
    else fetchPayouts();
  }, [activeTab, filterStatus, payoutFilter]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("payments")
        .select("id, total_amount, rental_amount, platform_fee, status, paid_at, created_at, rental:rentals!rental_id(id, status), payouts(payout_amount, status)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPayments(data || []);

      const { data: allPayments } = await supabase
        .from("payments")
        .select("platform_fee, total_amount, status");

      const completed = (allPayments || []).filter((p) => p.status === "completed");
      const refunded = (allPayments || []).filter((p) => p.status === "refunded");

      setStats({
        totalRevenue: completed.reduce((s, p) => s + Number(p.total_amount), 0),
        totalFees: completed.reduce((s, p) => s + Number(p.platform_fee), 0),
        completedCount: completed.length,
        refundedCount: refunded.length,
      });
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("payouts")
        .select("id, payout_amount, platform_fee, status, created_at, processed_at, owner:profiles!owner_id(full_name), payment:payments!payment_id(total_amount, status)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (payoutFilter !== "all") {
        query = query.eq("status", payoutFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPayouts(data || []);
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-500">Completed</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "refunded": return <Badge className="bg-orange-500">Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Payment Monitoring</h1>
            <p className="text-sm text-muted-foreground">Track transactions, fees, and refunds</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM{stats.totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Platform Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM{stats.totalFees.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Refunded</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.refundedCount}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-[250px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : payments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No transactions found
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(payment.status)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                            <span className="font-medium">RM{Number(payment.total_amount).toFixed(2)}</span>
                            <span className="text-muted-foreground">Fee: RM{Number(payment.platform_fee).toFixed(2)}</span>
                            <span className="text-muted-foreground">Rental: RM{Number(payment.rental_amount).toFixed(2)}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span>Rental: {payment.rental?.id?.slice(0, 8) || "N/A"} ({payment.rental?.status || "?"})</span>
                            {payment.paid_at && <span>Paid: {format(new Date(payment.paid_at), "MMM d, yyyy")}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 text-right">
                          <div>{format(new Date(payment.created_at), "MMM d, yyyy")}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <Select value={payoutFilter} onValueChange={setPayoutFilter}>
                  <SelectTrigger className="w-full md:w-[250px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : payouts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No payouts found
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout) => (
                  <Card key={payout.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(payout.status)}
                          </div>
                          <div className="mt-1">
                            <span className="font-medium">RM{Number(payout.payout_amount).toFixed(2)}</span>
                            <span className="text-muted-foreground ml-4">to {payout.owner?.full_name || "Unknown"}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span>Fee: RM{Number(payout.platform_fee).toFixed(2)}</span>
                            <span>Payment: RM{Number(payout.payment?.total_amount || 0).toFixed(2)}</span>
                            {payout.processed_at && <span>Processed: {format(new Date(payout.processed_at), "MMM d, yyyy")}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 text-right">
                          <div>{format(new Date(payout.created_at), "MMM d, yyyy")}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
