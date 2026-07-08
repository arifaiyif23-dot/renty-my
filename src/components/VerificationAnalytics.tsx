import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { Loader2, TrendingUp, Clock, CheckCircle, XCircle, Brain } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";

interface VerificationStats {
  daily: Array<{
    date: string;
    submitted: number;
    approved: number;
    rejected: number;
    aiApproved: number;
  }>;
  totals: {
    pending: number;
    approved: number;
    rejected: number;
    aiApproved: number;
    avgProcessingHours: number;
  };
  byDocType: Array<{
    name: string;
    count: number;
  }>;
}

export function VerificationAnalytics() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all verifications from last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      const { data: verifications, error } = await supabase
        .from('verification_requests')
        .select('id, status, document_type, created_at, verified_at, ai_analysis_result, overall_confidence_score')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      // Process daily stats
      const days = eachDayOfInterval({
        start: thirtyDaysAgo,
        end: new Date()
      });

      const dailyStats = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const dayVerifications = verifications?.filter(v => {
          const createdAt = new Date(v.created_at);
          return createdAt >= dayStart && createdAt < dayEnd;
        }) || [];

        const dayApproved = verifications?.filter(v => {
          if (!v.verified_at) return false;
          const verifiedAt = new Date(v.verified_at);
          return verifiedAt >= dayStart && verifiedAt < dayEnd && v.status === 'approved';
        }) || [];

        const dayRejected = verifications?.filter(v => {
          if (!v.verified_at) return false;
          const verifiedAt = new Date(v.verified_at);
          return verifiedAt >= dayStart && verifiedAt < dayEnd && v.status === 'rejected';
        }) || [];

        const dayAiApproved = dayApproved.filter(v => 
          (v.ai_analysis_result as any)?.autoApprove === true
        );

        return {
          date: format(day, 'MMM dd'),
          submitted: dayVerifications.length,
          approved: dayApproved.length,
          rejected: dayRejected.length,
          aiApproved: dayAiApproved.length
        };
      });

      // Calculate totals
      const pending = verifications?.filter(v => v.status === 'pending').length || 0;
      const approved = verifications?.filter(v => v.status === 'approved').length || 0;
      const rejected = verifications?.filter(v => v.status === 'rejected').length || 0;
      const aiApproved = verifications?.filter(v => 
        v.status === 'approved' && (v.ai_analysis_result as any)?.autoApprove === true
      ).length || 0;

      // Calculate average processing time
      const processedVerifications = verifications?.filter(v => v.verified_at) || [];
      let totalHours = 0;
      processedVerifications.forEach(v => {
        const created = new Date(v.created_at);
        const verified = new Date(v.verified_at);
        totalHours += (verified.getTime() - created.getTime()) / (1000 * 60 * 60);
      });
      const avgProcessingHours = processedVerifications.length > 0 
        ? totalHours / processedVerifications.length 
        : 0;

      // Count by document type
      const docTypeCounts: Record<string, number> = {};
      verifications?.forEach(v => {
        const docType = v.document_type || 'unknown';
        docTypeCounts[docType] = (docTypeCounts[docType] || 0) + 1;
      });
      const byDocType = Object.entries(docTypeCounts).map(([name, count]) => ({
        name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count
      }));

      setStats({
        daily: dailyStats.slice(-14), // Last 14 days for chart
        totals: {
          pending,
          approved,
          rejected,
          aiApproved,
          avgProcessingHours: Math.round(avgProcessingHours * 10) / 10
        },
        byDocType
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load analytics
        </CardContent>
      </Card>
    );
  }

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];
  const pieData = [
    { name: 'Approved', value: stats.totals.approved, color: '#10b981' },
    { name: 'Rejected', value: stats.totals.rejected, color: '#ef4444' },
    { name: 'Pending', value: stats.totals.pending, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const approvalRate = stats.totals.approved + stats.totals.rejected > 0
    ? Math.round((stats.totals.approved / (stats.totals.approved + stats.totals.rejected)) * 100)
    : 0;

  const aiAutomationRate = stats.totals.approved > 0
    ? Math.round((stats.totals.aiApproved / stats.totals.approved) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Approval Rate
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{approvalRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              AI Automation
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{aiAutomationRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Avg Processing
            </CardDescription>
            <CardTitle className="text-3xl">{stats.totals.avgProcessingHours}h</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total (30 days)</CardDescription>
            <CardTitle className="text-3xl">
              {stats.totals.approved + stats.totals.rejected + stats.totals.pending}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verification Trends (14 days)</CardTitle>
            <CardDescription>Daily submissions and approvals</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="submitted" 
                  stackId="1"
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.3}
                  name="Submitted"
                />
                <Area 
                  type="monotone" 
                  dataKey="approved" 
                  stackId="2"
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.6}
                  name="Approved"
                />
                <Area 
                  type="monotone" 
                  dataKey="aiApproved" 
                  stackId="3"
                  stroke="#8b5cf6" 
                  fill="#8b5cf6" 
                  fillOpacity={0.6}
                  name="AI Approved"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Distribution</CardTitle>
            <CardDescription>Last 30 days breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-semibold">{stats.totals.approved}</span>
                </div>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="font-semibold">{stats.totals.rejected}</span>
                </div>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">{stats.totals.pending}</span>
                </div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Type Distribution */}
      {stats.byDocType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Types</CardTitle>
            <CardDescription>Verification by document type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byDocType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
