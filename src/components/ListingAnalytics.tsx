import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Eye, Users, MousePointerClick, Calendar, CheckCircle, XCircle, DollarSign, Clock } from 'lucide-react';

interface ListingAnalyticsProps {
  itemId: string;
}

export function ListingAnalytics({ itemId }: ListingAnalyticsProps) {
  const { t } = useTranslation();

  const { data: analytics } = useQuery({
    queryKey: ['listing-analytics', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listing_analytics')
        .select('*')
        .eq('item_id', itemId)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const stats = analytics?.reduce(
    (acc, curr) => ({
      totalViews: acc.totalViews + (curr.views || 0),
      totalClicks: acc.totalClicks + (curr.clicks || 0),
      totalBookingRequests: acc.totalBookingRequests + (curr.booking_requests || 0),
      totalBookingsConfirmed: acc.totalBookingsConfirmed + (curr.bookings_confirmed || 0),
      totalRevenue: acc.totalRevenue + (parseFloat(curr.revenue?.toString() || '0')),
    }),
    { totalViews: 0, totalClicks: 0, totalBookingRequests: 0, totalBookingsConfirmed: 0, totalRevenue: 0 }
  ) || { totalViews: 0, totalClicks: 0, totalBookingRequests: 0, totalBookingsConfirmed: 0, totalRevenue: 0 };

  const conversionRate = stats.totalViews > 0 ? ((stats.totalBookingsConfirmed / stats.totalViews) * 100).toFixed(1) : '0';
  const clickThroughRate = stats.totalViews > 0 ? ((stats.totalClicks / stats.totalViews) * 100).toFixed(1) : '0';

  const chartData = analytics?.slice(-30).map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: item.views || 0,
    bookings: item.bookings_confirmed || 0,
    revenue: parseFloat(item.revenue?.toString() || '0'),
  })) || [];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.totalViews')}</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
            <p className="text-xs text-muted-foreground">{t('analytics.last30Days')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.clickThroughRate')}</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickThroughRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalClicks} {t('listings.bookings')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.confirmedBookings')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookingsConfirmed}</div>
            <p className="text-xs text-muted-foreground">{conversionRate}% {t('listings.conversionRate')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM {stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{t('analytics.last30Days')}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="views" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="views">{t('analytics.viewsOverTime')}</TabsTrigger>
          <TabsTrigger value="bookings">{t('analytics.bookingsByMonth')}</TabsTrigger>
          <TabsTrigger value="revenue">{t('analytics.revenueTrend')}</TabsTrigger>
        </TabsList>

        <TabsContent value="views">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.viewsOverTime')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.bookingsByMonth')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.revenueTrend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--secondary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.insights')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10">
            <div className="text-primary">💡</div>
            <div className="text-sm">
              <p className="font-medium">{t('analytics.performanceTip', { percent: 23 })}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/10">
            <div className="text-secondary">📱</div>
            <div className="text-sm">
              <p className="font-medium">{t('analytics.mobileTrafficTip', { percent: 67 })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
