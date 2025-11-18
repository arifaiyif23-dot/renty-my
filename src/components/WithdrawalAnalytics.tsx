import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownToLine, Clock, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface WithdrawalStats {
  totalToday: number;
  totalWeek: number;
  totalMonth: number;
  avgProcessingTime: number;
  approvalRate: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export function WithdrawalAnalytics() {
  const [stats, setStats] = useState<WithdrawalStats>({
    totalToday: 0,
    totalWeek: 0,
    totalMonth: 0,
    avgProcessingTime: 0,
    approvalRate: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all withdrawal requests
      const { data: withdrawals, error } = await supabase
        .from('withdrawal_requests')
        .select('*');

      if (error) throw error;

      if (!withdrawals) return;

      // Calculate stats
      const totalToday = withdrawals
        .filter(w => new Date(w.created_at) >= today)
        .reduce((sum, w) => sum + Number(w.amount), 0);

      const totalWeek = withdrawals
        .filter(w => new Date(w.created_at) >= weekAgo)
        .reduce((sum, w) => sum + Number(w.amount), 0);

      const totalMonth = withdrawals
        .filter(w => new Date(w.created_at) >= monthAgo)
        .reduce((sum, w) => sum + Number(w.amount), 0);

      const processed = withdrawals.filter(w => w.processed_at && w.created_at);
      const avgProcessingTime = processed.length > 0
        ? processed.reduce((sum, w) => {
            const created = new Date(w.created_at).getTime();
            const processed = new Date(w.processed_at).getTime();
            return sum + (processed - created);
          }, 0) / processed.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      const approved = withdrawals.filter(w => w.status === 'approved').length;
      const rejected = withdrawals.filter(w => w.status === 'rejected').length;
      const total = approved + rejected;
      const approvalRate = total > 0 ? (approved / total) * 100 : 0;

      const pendingCount = withdrawals.filter(w => w.status === 'pending').length;

      setStats({
        totalToday,
        totalWeek,
        totalMonth,
        avgProcessingTime,
        approvalRate,
        pendingCount,
        approvedCount: approved,
        rejectedCount: rejected
      });
    } catch (error) {
      console.error('Error fetching withdrawal stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center p-4">Loading analytics...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Today</CardTitle>
          <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">RM {stats.totalToday.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            Week: RM {stats.totalWeek.toFixed(2)} | Month: RM {stats.totalMonth.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgProcessingTime.toFixed(1)}h</div>
          <p className="text-xs text-muted-foreground">
            {stats.pendingCount} pending requests
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.approvalRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {stats.approvedCount} approved / {stats.approvedCount + stats.rejectedCount} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Approved:</span>
              <span className="font-semibold">{stats.approvedCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-yellow-600">Pending:</span>
              <span className="font-semibold">{stats.pendingCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-600">Rejected:</span>
              <span className="font-semibold">{stats.rejectedCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}