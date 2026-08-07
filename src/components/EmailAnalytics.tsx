import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  MousePointerClick,
  Eye,
  RefreshCw,
  Loader2,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { LazyRecharts } from "@/components/charts/LazyRecharts";

interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  bounceRate: number;
}

interface EmailLog {
  id: string;
  created_at: string;
  to_email: string;
  subject: string;
  template_type: string;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
}

interface DailyStats {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
}

const COLORS = ['hsl(var(--success))', 'hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

export default function EmailAnalytics() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [recentEmails, setRecentEmails] = useState<EmailLog[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmailData();
  }, []);

  const fetchEmailData = async () => {
    setLoading(true);
    try {
      // Fetch all email logs
      const { data: emails, error } = await supabase
        .from('email_logs')
        .select('id, status, to_email, subject, template_type, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const allEmails = emails || [];

      // Calculate stats
      const total = allEmails.length;
      const sent = allEmails.filter((e: EmailLog) => e.status !== 'failed').length;
      const delivered = allEmails.filter((e: EmailLog) => ['delivered', 'opened', 'clicked'].includes(e.status)).length;
      const opened = allEmails.filter((e: EmailLog) => ['opened', 'clicked'].includes(e.status)).length;
      const clicked = allEmails.filter((e: EmailLog) => e.status === 'clicked').length;
      const bounced = allEmails.filter((e: EmailLog) => e.status === 'bounced').length;
      const failed = allEmails.filter((e: EmailLog) => e.status === 'failed').length;

      setStats({
        total,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        failed,
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0
      });

      // Get recent emails (last 20)
      setRecentEmails(allEmails.slice(0, 20));

      // Calculate daily stats for last 14 days
      const last14Days: DailyStats[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayEmails = allEmails.filter((e: EmailLog) => 
          e.created_at.startsWith(dateStr)
        );
        
        last14Days.push({
          date: format(date, 'MMM dd'),
          sent: dayEmails.filter((e: EmailLog) => e.status !== 'failed').length,
          delivered: dayEmails.filter((e: EmailLog) => ['delivered', 'opened', 'clicked'].includes(e.status)).length,
          opened: dayEmails.filter((e: EmailLog) => ['opened', 'clicked'].includes(e.status)).length,
          bounced: dayEmails.filter((e: EmailLog) => e.status === 'bounced').length
        });
      }
      setDailyStats(last14Days);

    } catch (error) {
      console.error("Error fetching email data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="secondary">Sent</Badge>;
      case 'delivered':
        return <Badge className="bg-primary">Delivered</Badge>;
      case 'opened':
        return <Badge className="bg-success"><Eye className="h-3 w-3 mr-1" />Opened</Badge>;
      case 'clicked':
        return <Badge className="bg-action"><MousePointerClick className="h-3 w-3 mr-1" />Clicked</Badge>;
      case 'bounced':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Bounced</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTemplateLabel = (type: string) => {
    const labels: Record<string, string> = {
      'rental_request': 'Rental Request',
      'rental_approved': 'Rental Approved',
      'rental_paid': 'Payment Received',
      'rental_rejected': 'Rental Rejected',
      'verification_approved': 'Verification Approved',
      'verification_rejected': 'Verification Rejected'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pieData = stats ? [
    { name: 'Delivered', value: stats.delivered },
    { name: 'Opened', value: stats.opened },
    { name: 'Clicked', value: stats.clicked },
    { name: 'Bounced', value: stats.bounced },
    { name: 'Pending', value: stats.sent - stats.delivered - stats.bounced }
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.deliveryRate || 0}%</div>
            <p className="text-xs text-muted-foreground">{stats?.delivered || 0} delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.openRate || 0}%</div>
            <p className="text-xs text-muted-foreground">{stats?.opened || 0} opened</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${(stats?.bounceRate || 0) > 5 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(stats?.bounceRate || 0) > 5 ? 'text-destructive' : ''}`}>
              {stats?.bounceRate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">{stats?.bounced || 0} bounced</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <LazyRecharts>
        {(r) => {
          const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } = r;
          return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trend Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Email Trend (14 Days)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchEmailData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="sent" stackId="1" stroke={`hsl(var(--primary))`} fill={`hsl(var(--primary))`} fillOpacity={0.6} name="Sent" />
                  <Area type="monotone" dataKey="delivered" stackId="2" stroke={`hsl(var(--success))`} fill={`hsl(var(--success))`} fillOpacity={0.6} name="Delivered" />
                  <Area type="monotone" dataKey="opened" stackId="3" stroke={`hsl(var(--warning))`} fill={`hsl(var(--warning))`} fillOpacity={0.6} name="Opened" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No email data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No email data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
          );
        }}
      </LazyRecharts>

      {/* Recent Emails */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEmails.length > 0 ? (
            <div className="space-y-3">
              {recentEmails.map((email) => (
                <div key={email.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getTemplateLabel(email.template_type)}
                      </Badge>
                      {getStatusBadge(email.status)}
                    </div>
                    <p className="text-sm truncate">{email.to_email}</p>
                    <p className="text-xs text-muted-foreground truncate">{email.subject}</p>
                    {email.error_message && (
                      <p className="text-xs text-destructive">{email.error_message}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right ml-4">
                    {format(new Date(email.created_at), 'MMM dd, HH:mm')}
                    {email.opened_at && (
                      <div className="text-success">
                        Opened {format(new Date(email.opened_at), 'HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No emails sent yet</p>
              <p className="text-sm">Emails will appear here once the system starts sending notifications</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resend Webhook Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To track email delivery status (delivered, opened, clicked, bounced), configure a webhook in your Resend dashboard:
          </p>
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Webhook URL:</p>
            <code className="text-xs bg-background p-2 rounded block break-all">
              {new URL('/functions/v1/resend-webhook', supabase.supabaseUrl).href}
            </code>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Subscribe to these events:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>email.delivered</li>
              <li>email.opened</li>
              <li>email.clicked</li>
              <li>email.bounced</li>
              <li>email.complained</li>
            </ul>
          </div>
          <Button variant="outline" asChild>
            <a href="https://resend.com/webhooks" target="_blank" rel="noopener noreferrer">
              Open Resend Webhooks →
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}