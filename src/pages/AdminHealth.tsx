import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, RefreshCw, Mail, CreditCard, Database, Shield } from "lucide-react";
import Header from "@/components/Header";
import { toast } from "sonner";

type Stats = {
  payments_today: number;
  payments_paid_today: number;
  expired_pending: number;
  payouts_held: number;
  payouts_pending: number;
  payouts_awaiting_bank: number;
  emails_today: number;
  emails_delivered_today: number;
  emails_bounced_today: number;
  last_payment_log: string | null;
  encryption_configured: boolean;
};

type FlowLog = {
  id: string;
  stage: string;
  created_at: string;
  rental_id: string | null;
  details?: any;
};

export default function AdminHealth() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<FlowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: s, error: se }, { data: l }] = await Promise.all([
      supabase.rpc("get_system_health_stats"),
      supabase.from("payment_flow_logs").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    if (se) toast.error(se.message);
    setStats(s as Stats | null);
    setLogs(((l as unknown) as FlowLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runCleanup = async () => {
    setCleanupRunning(true);
    const { error } = await supabase.rpc("cleanup_expired_payments");
    setCleanupRunning(false);
    if (error) toast.error(error.message);
    else { toast.success("Expired payments cleaned"); load(); }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error("Enter a recipient email first");
      return;
    }
    setTestEmailSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-email-notification", {
        body: {
          to: testEmail.trim(),
          subject: "Renty — Test email from Admin Health",
          html: `<p>This is a test email from the Renty Admin Health dashboard.</p><p>If you can read this, Resend is delivering successfully.</p>`,
          type: "test",
        },
      });
      if (error) throw error;
      toast.success("Test email sent. Check the recipient inbox and Email Analytics.");
    } catch (e: any) {
      toast.error(e.message || "Failed to send test email");
    } finally {
      setTestEmailSending(false);
    }
  };

  const deliveryRate = stats && stats.emails_today > 0
    ? Math.round((stats.emails_delivered_today / stats.emails_today) * 100)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">System Health</h1>
            <p className="text-sm text-muted-foreground">Production readiness monitoring</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {stats && !stats.encryption_configured && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertTitle>Message encryption not configured</AlertTitle>
            <AlertDescription>
              Database setting <code>app.settings.encryption_key</code> is missing. New messages will not be encrypted.
              Contact support to set the production encryption key before launch.
            </AlertDescription>
          </Alert>
        )}

        {stats && stats.expired_pending > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{stats.expired_pending} expired pending payments</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Run cleanup to cancel stale rentals.</span>
              <Button size="sm" onClick={runCleanup} disabled={cleanupRunning}>
                {cleanupRunning ? "Running..." : "Run cleanup"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<CreditCard className="h-4 w-4" />} label="Payments today" value={stats?.payments_today ?? "—"} sub={`${stats?.payments_paid_today ?? 0} paid`} />
          <StatCard icon={<Database className="h-4 w-4" />} label="Payouts held (escrow)" value={stats?.payouts_held ?? "—"} sub={`${stats?.payouts_pending ?? 0} pending payout`} />
          <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Awaiting bank details" value={stats?.payouts_awaiting_bank ?? "—"} sub="Owners must add bank" />
          <StatCard
            icon={<Mail className="h-4 w-4" />}
            label="Email delivery today"
            value={deliveryRate !== null ? `${deliveryRate}%` : "—"}
            sub={`${stats?.emails_today ?? 0} sent · ${stats?.emails_bounced_today ?? 0} bounced`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Readiness checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CheckRow ok={!!stats?.encryption_configured} label="Message encryption key configured" />
            <CheckRow ok={(stats?.payments_paid_today ?? 0) > 0 || (stats?.payouts_held ?? 0) > 0} label="At least one successful end-to-end payment processed" />
            <CheckRow ok={(stats?.emails_delivered_today ?? 0) > 0} label="Resend delivering emails today" />
            <CheckRow ok={(stats?.payouts_awaiting_bank ?? 0) === 0} label="No payouts blocked on missing bank details" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent payment flow logs</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment flow events yet.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.stage}</Badge>
                      <span className="text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.rental_id && (
                      <code className="text-xs text-muted-foreground">{log.rental_id.slice(0, 8)}</code>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon}{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
