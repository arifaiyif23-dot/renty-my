import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownToLine, Clock, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface WithdrawalStats {
  totalToday: number;
  totalWeek: number;
  totalMonth: number;
  avgProcessingTime: number;
  approvalRate: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalProcessingFees: number;
  avgAmount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

export function WithdrawalAnalytics() {
  const [stats, setStats] = useState<WithdrawalStats>({
    totalToday: 0,
    totalWeek: 0,
    totalMonth: 0,
    avgProcessingTime: 0,
    approvalRate: '0.0',
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalProcessingFees: 0,
    avgAmount: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: withdrawals, error } = await supabase
        .from('withdrawal_requests')
        .select('*');

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

      let totalToday = 0;
      let totalWeek = 0;
      let totalMonth = 0;
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;
      let processingTimeSum = 0;
      let processingTimeCount = 0;
      let totalProcessingFees = 0;
      let totalAmount = 0;
      let highRiskCount = 0;
      let mediumRiskCount = 0;
      let lowRiskCount = 0;

      withdrawals?.forEach((w) => {
        const created = new Date(w.created_at);
        const amount = Number(w.amount);
        totalAmount += amount;

        const risk = w.risk_score || 0;
        if (risk >= 50) highRiskCount++;
        else if (risk >= 30) mediumRiskCount++;
        else lowRiskCount++;

        if (created >= today) totalToday += amount;
        if (created >= weekAgo) totalWeek += amount;
        if (created >= monthAgo) totalMonth += amount;

        if (w.status === 'pending') pendingCount++;
        else if (w.status === 'approved') {
          approvedCount++;
          if (w.processed_at) {
            const processedTime = new Date(w.processed_at).getTime() - created.getTime();
            processingTimeSum += processedTime;
            processingTimeCount++;
          }
          totalProcessingFees += 2;
        } else if (w.status === 'rejected') {
          rejectedCount++;
        }
      });

      const avgProcessingTime = processingTimeCount > 0 
        ? Math.round(processingTimeSum / processingTimeCount / (1000 * 60 * 60)) 
        : 0;

      const approvalRate = (approvedCount + rejectedCount) > 0
        ? ((approvedCount / (approvedCount + rejectedCount)) * 100).toFixed(1)
        : '0.0';

      const avgAmount = withdrawals?.length ? (totalAmount / withdrawals.length).toFixed(2) : '0.00';

      setStats({
        totalToday,
        totalWeek,
        totalMonth,
        avgProcessingTime,
        approvalRate,
        pendingCount,
        approvedCount,
        rejectedCount,
        totalProcessingFees,
        avgAmount: Number(avgAmount),
        highRiskCount,
        mediumRiskCount,
        lowRiskCount
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
          <div className="text-2xl font-bold">{stats.approvalRate}%</div>
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