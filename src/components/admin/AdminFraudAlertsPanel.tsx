import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface FraudAlert {
  id: string;
  user_id: string;
  alert_type: string;
  risk_score: number;
  status: string;
  details: Record<string, unknown>;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface AdminFraudAlertsPanelProps {
  alerts: FraudAlert[];
  filterStatus: string;
  onFilterStatusChange: (val: string) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onAction: (alertId: string, action: 'reviewed' | 'dismissed') => void;
}

function getRiskBadge(score: number) {
  if (score >= 80) return <Badge className="rounded-full" variant="destructive">Critical Risk ({score}%)</Badge>;
  if (score >= 60) return <Badge className="bg-warning rounded-full">High Risk ({score}%)</Badge>;
  if (score >= 40) return <Badge className="bg-warning rounded-full">Medium Risk ({score}%)</Badge>;
  return <Badge className="rounded-full" variant="secondary">Low Risk ({score}%)</Badge>;
}

export function AdminFraudAlertsPanel({
  alerts,
  filterStatus,
  onFilterStatusChange,
  searchQuery,
  onSearchQueryChange,
  onAction,
}: AdminFraudAlertsPanelProps) {
  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search fraud alerts..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="rounded-xl pl-10"
              />
            </div>
          </div>
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="w-full md:w-[200px] rounded-xl">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      <div className="grid gap-4">
        {alerts.length === 0 ? (
          <GlassCard>
            <p className="text-center text-muted-foreground">No fraud alerts found</p>
          </GlassCard>
        ) : (
          alerts.map((alert) => (
            <GlassCard key={alert.id} className="border-l-4 border-l-destructive">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold capitalize">{alert.alert_type.replace(/_/g, ' ')}</h4>
                  <p className="text-sm text-muted-foreground">
                    User: {alert.profiles?.full_name} | {format(new Date(alert.created_at), "MMM dd, yyyy HH:mm")}
                  </p>
                </div>
                {getRiskBadge(alert.risk_score)}
              </div>

              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Details:</p>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(alert.details, null, 2)}
                  </pre>
                </div>
                {alert.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button className="rounded-xl" size="sm" onClick={() => onAction(alert.id, 'reviewed')}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Reviewed
                    </Button>
                    <Button className="rounded-xl" size="sm" variant="outline" onClick={() => onAction(alert.id, 'dismissed')}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Dismiss
                    </Button>
                  </div>
                ) : (
                  <Badge className="rounded-full" variant="secondary">
                    Status: {alert.status}
                  </Badge>
                )}
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
