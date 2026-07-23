import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdminLayout } from "@/components/AdminLayout";
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  DollarSign,
  ShoppingCart
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminAutomation() {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch cron job logs
  const { data: cronLogs, isLoading: cronLoading, refetch: refetchCronLogs } = useQuery({
    queryKey: ["cron-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cron_job_logs")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch payment flow logs
  const { data: paymentLogs, isLoading: paymentLoading, refetch: refetchPaymentLogs } = useQuery({
    queryKey: ["payment-flow-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_flow_logs")
        .select("*, payments(id, total_amount, status), rentals(id, renter_id)")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent payments
  const { data: recentPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["recent-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, rentals(id, item_id, renter_id, owner_id)")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch system health metrics
  const { data: healthMetrics } = useQuery({
    queryKey: ["health-metrics"],
    queryFn: async () => {
      const [payments, rentals, errors] = await Promise.all([
        supabase.from("payments").select("status", { count: "exact" }),
        supabase.from("rentals").select("status", { count: "exact" }),
        supabase.from("payment_flow_logs").select("*", { count: "exact" }).eq("status", "error").gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        totalPayments: payments.count || 0,
        totalRentals: rentals.count || 0,
        recentErrors: errors.count || 0,
      };
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchCronLogs(), refetchPaymentLogs()]);
      toast.success("Data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const loading = cronLoading || paymentLoading || paymentsLoading;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AdminLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      info: "secondary",
      error: "destructive",
    };
    return <Badge className="rounded-full" variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getStageBadge = (stage: string) => {
    const colors: Record<string, string> = {
      rental_created: "bg-primary",
      payment_created: "bg-secondary",
      bill_created: "bg-primary",
      callback_received: "bg-warning",
      payment_verified: "bg-success",
      payment_failed: "bg-destructive",
      payment_expired: "bg-warning",
    };
    return (
      <Badge variant="outline" className={colors[stage]}>
        {stage.replace(/_/g, " ")}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Automation & Monitoring</h1>
            <p className="text-muted-foreground mt-2">
              Monitor cron jobs, payment flows, and system health
            </p>
          </div>
          <Button className="rounded-xl" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Health Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <GlassCard>
            
              
                <DollarSign className="h-4 w-4 mr-2 text-primary" />
                Total Payments
              
            
            
              <div className="text-2xl font-bold">{healthMetrics?.totalPayments || 0}</div>
            
          </GlassCard>
          
          <GlassCard>
            
              
                <ShoppingCart className="h-4 w-4 mr-2 text-primary" />
                Total Rentals
              
            
            
              <div className="text-2xl font-bold">{healthMetrics?.totalRentals || 0}</div>
            
          </GlassCard>

          <GlassCard>
            
              
                <Activity className="h-4 w-4 mr-2 text-success" />
                Cron Jobs
              
            
            
              <div className="text-2xl font-bold text-success">Active</div>
              <p className="text-xs text-muted-foreground mt-1">2 jobs running</p>
            
          </GlassCard>

          <GlassCard>
            
              
                <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
                Errors (24h)
              
            
            
              <div className="text-2xl font-bold text-destructive">
                {healthMetrics?.recentErrors || 0}
              </div>
            
          </GlassCard>
        </div>

        <Tabs defaultValue="payment-flow" className="space-y-4">
          <TabsList>
            <TabsTrigger value="payment-flow">Payment Flow</TabsTrigger>
            <TabsTrigger value="cron-jobs">Cron Jobs</TabsTrigger>
            <TabsTrigger value="recent-payments">Recent Payments</TabsTrigger>
          </TabsList>

          {/* Payment Flow Logs */}
          <TabsContent value="payment-flow" className="space-y-4">
            <GlassCard>
              
                Payment Flow Tracking
                
                  Track the complete payment lifecycle from rental creation to verification
                
              
              
                {!paymentLogs || paymentLogs.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No payment flow logs yet</AlertTitle>
                    <AlertDescription>
                      Payment flow logs will appear here when users create bookings
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {paymentLogs.map((log: { id: string; stage: string; status: string; payment_id?: string; details?: unknown; created_at: string }) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            {getStageBadge(log.stage)}
                            {getStatusBadge(log.status)}
                            {log.payment_id && (
                              <Badge variant="outline" className="font-mono text-xs rounded-full">
                                {log.payment_id.slice(0, 8)}
                              </Badge>
                            )}
                          </div>
                          {log.details && (
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground ml-4">
                          {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              
            </GlassCard>
          </TabsContent>

          {/* Cron Jobs */}
          <TabsContent value="cron-jobs" className="space-y-4">
            <GlassCard>
              
                Cron Job Execution History
                
                  Monitor automated cleanup and transition jobs
                
              
              
                {!cronLogs || cronLogs.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No cron logs yet</AlertTitle>
                    <AlertDescription>
                      Cron job logs will appear here once they start running
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {cronLogs.map((log: { id: string; status: string; job_name: string; records_processed?: number; error_message?: string; executed_at: string }) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {log.status === "success" ? (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                          <div>
                            <div className="font-medium">{log.job_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {log.records_processed || 0} records processed
                            </div>
                            {log.error_message && (
                              <div className="text-sm text-destructive mt-1">
                                {log.error_message}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.executed_at), "MMM d, HH:mm")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              
            </GlassCard>

            <GlassCard>
              
                Scheduled Jobs
                Active cron jobs configuration
              
              
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">cleanup-expired-payments</div>
                    <div className="text-sm text-muted-foreground">
                      Runs every 10 minutes
                    </div>
                  </div>
                  <Badge className="rounded-full" variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">process-rental-transitions</div>
                    <div className="text-sm text-muted-foreground">
                      Runs every 15 minutes
                    </div>
                  </div>
                  <Badge className="rounded-full" variant="default">Active</Badge>
                </div>
              
            </GlassCard>
          </TabsContent>

          {/* Recent Payments */}
          <TabsContent value="recent-payments" className="space-y-4">
            <GlassCard>
              
                Recent Payments
                Latest payment transactions
              
              
                {!recentPayments || recentPayments.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No payments yet</AlertTitle>
                    <AlertDescription>
                      Payment records will appear here when users complete bookings
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {recentPayments.map((payment: { id: string; total_amount: number; status: string; created_at: string }) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="font-medium font-mono text-sm">
                            {payment.id.slice(0, 8)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            RM {payment.total_amount.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(payment.status)}
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(payment.created_at), "MMM d, HH:mm")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
