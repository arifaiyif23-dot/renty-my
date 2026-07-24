import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from '@/components/ui/GlassCard';
import { ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { invokeAdminOperation } from "@/lib/adminOperations";

interface FraudAlert {
  id: string;
  user_id: string;
  alert_type: string;
  risk_score: number;
  status: string;
  details: Record<string, unknown>;
  created_at: string;
  profiles: { full_name: string };
}

interface AdminFraudAlertListProps {
  alerts: FraudAlert[];
  onRefresh: () => void;
}

export function AdminFraudAlertList({ alerts, onRefresh }: AdminFraudAlertListProps) {
  if (alerts.length === 0) {
    return (
      <GlassCard>
        <p className="text-center text-muted-foreground">No pending fraud alerts</p>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-4">
      {alerts.map((alert) => (
        <GlassCard key={alert.id} className="border-destructive">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
              </h4>
              <p className="text-sm text-muted-foreground">
                User: {alert.profiles?.full_name} | {format(new Date(alert.created_at), "MMM dd, yyyy HH:mm")}
              </p>
            </div>
            <Badge className="rounded-full" variant="destructive">Risk: {alert.risk_score}%</Badge>
          </div>

          <div className="bg-destructive/10 p-4 rounded-lg mb-4">
            <p className="text-sm font-medium mb-2">Alert Details:</p>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(alert.details, null, 2)}
            </pre>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                try {
                  await invokeAdminOperation({ action: 'fraud_alert_action', alertId: alert.id, status: 'reviewed' });
                  toast.success("Alert marked as reviewed");
                  onRefresh();
                } catch {
                  toast.error("Failed to update alert");
                }
              }}
            >
              Mark as Reviewed
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-xl"
              onClick={async () => {
                try {
                  await invokeAdminOperation({ action: 'fraud_alert_action', alertId: alert.id, status: 'escalated' });
                  toast.success("Alert escalated");
                  onRefresh();
                } catch {
                  toast.error("Failed to escalate alert");
                }
              }}
            >
              Escalate
            </Button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
