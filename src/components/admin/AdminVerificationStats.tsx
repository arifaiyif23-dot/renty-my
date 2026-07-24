import { GlassCard } from '@/components/ui/GlassCard';

interface DashboardStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  highRiskCount: number;
  avgConfidenceScore: number;
}

export function AdminVerificationStats({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <GlassCard>
        <div className="text-sm text-muted-foreground mb-1">Pending Review</div>
        <div className="text-2xl font-bold">{stats.pendingCount}</div>
      </GlassCard>
      <GlassCard>
        <div className="text-sm text-muted-foreground mb-1">Approved Today</div>
        <div className="text-2xl font-bold">{stats.approvedToday}</div>
      </GlassCard>
      <GlassCard>
        <div className="text-sm text-muted-foreground mb-1">Rejected Today</div>
        <div className="text-2xl font-bold">{stats.rejectedToday}</div>
      </GlassCard>
      <GlassCard>
        <div className="text-sm text-muted-foreground mb-1">High Risk</div>
        <div className="text-2xl font-bold">{stats.highRiskCount}</div>
      </GlassCard>
      <GlassCard>
        <div className="text-sm text-muted-foreground mb-1">Avg Confidence</div>
        <div className="text-2xl font-bold">{stats.avgConfidenceScore}%</div>
      </GlassCard>
    </div>
  );
}
