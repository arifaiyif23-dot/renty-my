import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Users, 
  TrendingUp,
  Eye,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  FileCheck,
  Mail,
  Package,
  Flag
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import EmailAnalytics from "@/components/EmailAnalytics";
import { invokeAdminOperation } from "@/lib/adminOperations";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getSignedUrl } from "@/utils/signedUrls";

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

interface VerificationRequest {
  id: string;
  user_id: string;
  status: string;
  document_type: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  full_name_on_document: string;
  date_of_birth: string | null;
  document_quality_score: number | null;
  face_match_score: number | null;
  liveness_score: number | null;
  overall_confidence_score: number | null;
  fraud_risk_score: number | null;
  ai_analysis_result: Record<string, unknown> | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

interface DashboardStats {
  pendingVerifications: number;
  pendingFraudAlerts: number;
  totalVerifications: number;
  approvalRate: number;
  totalUsers: number;
  activeListings: number;
  activeRentals: number;
  completedRentals: number;
  platformRevenue: number;
  totalReports: number;
  openDisputes: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    pendingVerifications: 0,
    pendingFraudAlerts: 0,
    totalVerifications: 0,
    approvalRate: 0,
    totalUsers: 0,
    activeListings: 0,
    activeRentals: 0,
    completedRentals: 0,
    platformRevenue: 0,
    totalReports: 0,
    openDisputes: 0,
  });
  
  // Fraud Alerts State
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [fraudFilterStatus, setFraudFilterStatus] = useState("pending");
  const [fraudSearchQuery, setFraudSearchQuery] = useState("");
  
  // Verification State
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [verificationFilterStatus, setVerificationFilterStatus] = useState("pending");
  const [verificationSearchQuery, setVerificationSearchQuery] = useState("");
  const [selectedVerifications, setSelectedVerifications] = useState<Set<string>>(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkRejectionReason, setBulkRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "fraud-alerts") {
      fetchFraudAlerts();
    } else if (activeTab === "verifications") {
      fetchVerifications();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fraudFilterStatus, verificationFilterStatus]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchFraudAlerts(),
        fetchVerifications()
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [{ count: pendingCount }, { count: fraudCount }, { count: totalCount }, { count: approvedCount }, { count: totalUsers }, { count: activeListings }, { count: activeRentals }, { count: completedRentals }, { count: totalReports }, { count: openDisputes }, { data: revenueData }] = await Promise.all([
        supabase.from('verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('fraud_alerts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('verification_requests').select('*', { count: 'exact', head: true }),
        supabase.from('verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_available', true),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).in('status', ['paid', 'active', 'approved']),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).neq('status', 'dismissed'),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('is_disputed', true).or('dispute_status.is.null,dispute_status.eq.open'),
        supabase.from('payments').select('platform_fee').eq('status', 'completed'),
      ]);

      const approvalRate = totalCount ? ((approvedCount || 0) / totalCount) * 100 : 0;
      const platformRevenue = (revenueData || []).reduce((sum, p) => sum + Number(p.platform_fee), 0);

      setStats({
        pendingVerifications: pendingCount || 0,
        pendingFraudAlerts: fraudCount || 0,
        totalVerifications: totalCount || 0,
        approvalRate: Math.round(approvalRate),
        totalUsers: totalUsers || 0,
        activeListings: activeListings || 0,
        activeRentals: activeRentals || 0,
        completedRentals: completedRentals || 0,
        platformRevenue,
        totalReports: totalReports || 0,
        openDisputes: openDisputes || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchFraudAlerts = async () => {
    try {
      let query = supabase
        .from('fraud_alerts')
        .select(`id, user_id, status, alert_type, risk_score, details, created_at`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fraudFilterStatus !== "all") {
        query = query.eq('status', fraudFilterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const alerts = data || [];
      const userIds = [...new Set(alerts.map(a => a.user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
        setFraudAlerts(alerts.map(a => ({ ...a, profiles: profileMap.get(a.user_id) })));
      } else {
        setFraudAlerts(alerts);
      }
    } catch (error) {
      console.error("Error fetching fraud alerts:", error);
      toast.error("Failed to load fraud alerts");
    }
  };

  const fetchVerifications = async () => {
    try {
      let query = supabase
        .from('verification_requests')
        .select(`id, user_id, document_type, status, created_at`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (verificationFilterStatus !== "all") {
        query = query.eq('status', verificationFilterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const v = data || [];
      const userIds = [...new Set(v.map(x => x.user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
        setVerifications(v.map(x => ({ ...x, profiles: { full_name: profileMap.get(x.user_id) || 'Unknown' } })));
      } else {
        setVerifications(v.map(x => ({ ...x, profiles: { full_name: 'Unknown' } })));
      }
    } catch (error) {
      console.error("Error fetching verifications:", error);
      toast.error("Failed to load verifications");
    }
  };

  const handleFraudAlertAction = async (alertId: string, action: 'reviewed' | 'dismissed') => {
    try {
      await invokeAdminOperation({ action: 'fraud_alert_action', alertId, status: action });

      toast.success(`Alert ${action} successfully`);
      fetchFraudAlerts();
      fetchStats();
    } catch (error) {
      console.error("Error updating fraud alert:", error);
      toast.error("Failed to update fraud alert");
    }
  };

  const handleBulkAction = async () => {
    if (selectedVerifications.size === 0 || !bulkAction) return;

    if (bulkAction === 'reject' && !bulkRejectionReason) {
      toast.error("Please select a rejection reason");
      return;
    }

    setProcessing(true);

    try {
      const verificationIds = Array.from(selectedVerifications);
      
      await invokeAdminOperation({
        action: 'batch_verify_identity',
        ids: verificationIds,
        status: bulkAction === 'approve' ? 'approved' : 'rejected',
        rejectionReason: bulkRejectionReason || undefined,
      });

      toast.success(`${verificationIds.length} verifications ${bulkAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      
      setShowBulkDialog(false);
      setSelectedVerifications(new Set());
      setBulkAction(null);
      setBulkRejectionReason("");
      fetchVerifications();
      fetchStats();
    } catch (error) {
      console.error("Error processing bulk action:", error);
      toast.error("Failed to process bulk action");
    } finally {
      setProcessing(false);
    }
  };

  const toggleVerificationSelection = (id: string) => {
    const newSelection = new Set(selectedVerifications);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVerifications(newSelection);
  };

  const selectAllVerifications = () => {
    const filteredIds = filteredVerifications
      .filter(v => v.status === 'pending')
      .map(v => v.id);
    setSelectedVerifications(new Set(filteredIds));
  };

  const clearSelection = () => {
    setSelectedVerifications(new Set());
  };

  const filteredFraudAlerts = fraudAlerts.filter(alert => {
    if (!fraudSearchQuery) return true;
    const query = fraudSearchQuery.toLowerCase();
    return (
      alert.alert_type?.toLowerCase().includes(query) ||
      alert.profiles?.full_name?.toLowerCase().includes(query)
    );
  });

  const filteredVerifications = verifications.filter(v => {
    if (!verificationSearchQuery) return true;
    const query = verificationSearchQuery.toLowerCase();
    return (
      v.full_name_on_document?.toLowerCase().includes(query) ||
      v.profiles?.full_name?.toLowerCase().includes(query)
    );
  });

  const getRiskBadge = (score: number) => {
    if (score >= 80) return <Badge className="rounded-full" variant="destructive">Critical Risk ({score}%)</Badge>;
    if (score >= 60) return <Badge className="bg-warning rounded-full">High Risk ({score}%)</Badge>;
    if (score >= 40) return <Badge className="bg-warning rounded-full">Medium Risk ({score}%)</Badge>;
    return <Badge className="rounded-full" variant="secondary">Low Risk ({score}%)</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="rounded-full" variant="secondary">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-success rounded-full"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="rounded-full" variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="rounded-full">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage verifications, fraud alerts, and platform security</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/health" className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-accent">System Health</a>
            <a href="/admin/disputes" className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-accent">Disputes</a>
            <a href="/admin/payouts" className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-accent">Payouts</a>
            <a href="/admin/automation" className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-accent">Automation</a>
            <a href="/admin/settings" className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-accent">Settings</a>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="fraud-alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Fraud Alerts
              {stats.pendingFraudAlerts > 0 && (
                <Badge className="ml-2 rounded-full" variant="destructive">{stats.pendingFraudAlerts}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verifications">
              <Shield className="h-4 w-4 mr-2" />
              Verifications
              {stats.pendingVerifications > 0 && (
                <Badge className="ml-2 rounded-full" variant="secondary">{stats.pendingVerifications}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassCard>
                
                  Total Users
                  <Users className="h-4 w-4 text-muted-foreground" />
                
                
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">Registered</p>
                
              </GlassCard>

              <GlassCard>
                
                  Active Listings
                  <Package className="h-4 w-4 text-muted-foreground" />
                
                
                  <div className="text-2xl font-bold">{stats.activeListings}</div>
                  <p className="text-xs text-muted-foreground">Available to rent</p>
                
              </GlassCard>

              <GlassCard>
                
                  Active Rentals
                  <TrendingUp className="h-4 w-4 text-success" />
                
                
                  <div className="text-2xl font-bold">{stats.activeRentals}</div>
                  <p className="text-xs text-muted-foreground">In progress</p>
                
              </GlassCard>

              <GlassCard>
                
                  Completed Rentals
                  <CheckCircle className="h-4 w-4 text-success" />
                
                
                  <div className="text-2xl font-bold">{stats.completedRentals}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                
              </GlassCard>

              <GlassCard>
                
                  Platform Revenue
                  <TrendingUp className="h-4 w-4 text-primary" />
                
                
                  <div className="text-2xl font-bold">RM{stats.platformRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">From completed payments</p>
                
              </GlassCard>

              <GlassCard>
                
                  Pending Actions
                  <AlertTriangle className="h-4 w-4 text-warning" />
                
                
                  <div className="text-2xl font-bold">{stats.pendingVerifications + stats.totalReports + stats.openDisputes}</div>
                  <p className="text-xs text-muted-foreground">Verifications + Reports + Disputes</p>
                
              </GlassCard>

              <GlassCard>
                
                  Open Reports
                  <Flag className="h-4 w-4 text-muted-foreground" />
                
                
                  <div className="text-2xl font-bold">{stats.totalReports}</div>
                  <p className="text-xs text-muted-foreground">Pending review</p>
                
              </GlassCard>

              <GlassCard>
                
                  Open Disputes
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                
                
                  <div className="text-2xl font-bold">{stats.openDisputes}</div>
                  <p className="text-xs text-muted-foreground">Need resolution</p>
                
              </GlassCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard>
                
                  Quick Actions
                
                
                  <Button 
                    className="w-full justify-start rounded-xl" 
                    variant="outline"
                    onClick={() => setActiveTab("verifications")}
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    Review Pending Verifications ({stats.pendingVerifications})
                  </Button>
                  <Button 
                    className="w-full justify-start rounded-xl" 
                    variant="outline"
                    onClick={() => setActiveTab("fraud-alerts")}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Check Fraud Alerts ({stats.pendingFraudAlerts})
                  </Button>
                  <Button 
                    className="w-full justify-start rounded-xl" 
                    variant="outline"
                    onClick={() => navigate("/admin/listings")}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Manage Listings ({stats.activeListings})
                  </Button>
                  <Button 
                    className="w-full justify-start rounded-xl" 
                    variant="outline"
                    onClick={() => navigate("/admin/rentals")}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Rentals
                  </Button>
                  <Button 
                    className="w-full justify-start rounded-xl" 
                    variant="outline"
                    onClick={() => navigate("/admin/payments")}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Payment Monitoring
                  </Button>
                  <Button 
                    className="w-full justify-start rounded-xl" 
                    variant="outline"
                    onClick={fetchAllData}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Dashboard
                  </Button>
                
              </GlassCard>

              <GlassCard>
                
                  Pending Items
                
                
                  <div className="flex items-center justify-between text-sm">
                    <span>Verifications</span>
                    <span className="font-bold">{stats.pendingVerifications}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Fraud Alerts</span>
                    <span className="font-bold">{stats.pendingFraudAlerts}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Open Reports</span>
                    <span className="font-bold">{stats.totalReports}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Open Disputes</span>
                    <span className="font-bold">{stats.openDisputes}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-2 mt-2">
                    <span className="font-medium">Total Pending</span>
                    <span className="font-bold">{stats.pendingVerifications + stats.pendingFraudAlerts + stats.totalReports + stats.openDisputes}</span>
                  </div>
                
              </GlassCard>
            </div>
          </TabsContent>

          {/* Fraud Alerts Tab */}
          <TabsContent value="fraud-alerts" className="space-y-4">
            <GlassCard>
              
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search fraud alerts..."
                        value={fraudSearchQuery}
                        onChange={(e) => setFraudSearchQuery(e.target.value)}
                        className="rounded-xl pl-10"
                      />
                    </div>
                  </div>
                  <Select value={fraudFilterStatus} onValueChange={setFraudFilterStatus}>
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
              {filteredFraudAlerts.length === 0 ? (
                <GlassCard>
                  
                    No fraud alerts found
                  
                </GlassCard>
              ) : (
                filteredFraudAlerts.map((alert) => (
                  <GlassCard key={alert.id} className="border-l-4 border-l-destructive">
                    
                      <div className="flex items-start justify-between">
                        <div>
                          {alert.alert_type.replace(/_/g, ' ')}
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
                        {alert.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button className="rounded-xl"
                              size="sm"
                              onClick={() => handleFraudAlertAction(alert.id, 'reviewed')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Reviewed
                            </Button>
                            <Button className="rounded-xl"
                              size="sm"
                              variant="outline"
                              onClick={() => handleFraudAlertAction(alert.id, 'dismissed')}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Dismiss
                            </Button>
                          </div>
                        )}
                        {alert.status !== 'pending' && (
                          <Badge className="rounded-full" variant="secondary">
                            Status: {alert.status}
                          </Badge>
                        )}
                      </div>
                    
                  </GlassCard>
                ))
              )}
            </div>
          </TabsContent>

          {/* Verifications Tab */}
          <TabsContent value="verifications" className="space-y-4">
            <GlassCard>
              
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or IC number..."
                          value={verificationSearchQuery}
                          onChange={(e) => setVerificationSearchQuery(e.target.value)}
                          className="rounded-xl pl-10"
                        />
                      </div>
                    </div>
                    <Select value={verificationFilterStatus} onValueChange={setVerificationFilterStatus}>
                      <SelectTrigger className="w-full md:w-[200px] rounded-xl">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulk Actions */}
                  {selectedVerifications.size > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">
                        {selectedVerifications.size} selected
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setBulkAction('approve');
                          setShowBulkDialog(true);
                        }}
                        className="rounded-xl bg-success hover:bg-success/90"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Bulk Approve
                      </Button>
                      <Button className="rounded-xl" 
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setBulkAction('reject');
                          setShowBulkDialog(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Bulk Reject
                      </Button>
                      <Button className="rounded-xl" 
                        size="sm"
                        variant="outline"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                    </div>
                  )}

                  {verificationFilterStatus === 'pending' && filteredVerifications.some(v => v.status === 'pending') && (
                    <Button className="rounded-xl" 
                      variant="outline" 
                      size="sm"
                      onClick={selectAllVerifications}
                    >
                      Select All Pending
                    </Button>
                  )}
                </div>
              
            </GlassCard>

            <div className="grid gap-4">
              {filteredVerifications.length === 0 ? (
                <GlassCard>
                  
                    No verification requests found
                  
                </GlassCard>
              ) : (
                filteredVerifications.map((verification) => (
                  <GlassCard key={verification.id}>
                    
                      <div className="flex items-start gap-4">
                        {verification.status === 'pending' && (
                          <Checkbox
                            checked={selectedVerifications.has(verification.id)}
                            onCheckedChange={() => toggleVerificationSelection(verification.id)}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              {verification.full_name_on_document}
                              <p className="text-sm text-muted-foreground">
                                User: {verification.profiles?.full_name} | {format(new Date(verification.created_at), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                            {getStatusBadge(verification.status)}
                          </div>
                        </div>
                      </div>
                    
                    
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Document Type</p>
                          <p className="text-sm text-muted-foreground capitalize">{verification.document_type}</p>
                        </div>
                        {verification.date_of_birth && (
                          <div>
                            <p className="text-sm font-medium mb-1">Date of Birth</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(verification.date_of_birth), "MMM dd, yyyy")}</p>
                          </div>
                        )}
                      </div>

                      {verification.overall_confidence_score !== null && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 p-4 bg-muted rounded-lg">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Overall AI Score</p>
                            <p className="text-lg font-bold">{verification.overall_confidence_score}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Quality</p>
                            <p className="text-lg font-bold">{verification.document_quality_score}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Face Match</p>
                            <p className="text-lg font-bold">{verification.face_match_score}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Liveness</p>
                            <p className="text-lg font-bold">{verification.liveness_score}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Fraud Risk</p>
                            <p className="text-lg font-bold text-destructive">{verification.fraud_risk_score}%</p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <Button className="rounded-xl"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              if (verification.document_front_url) {
                                const frontUrl = await getSignedUrl(verification.document_front_url);
                                window.open(frontUrl, '_blank');
                              }

                              if (verification.document_back_url) {
                                const backUrl = await getSignedUrl(verification.document_back_url);
                                window.open(backUrl, '_blank');
                              }

                              if (verification.selfie_url) {
                                const selfieUrl = await getSignedUrl(verification.selfie_url);
                                window.open(selfieUrl, '_blank');
                              }
                            } catch (error) {
                              toast.error("Failed to load documents");
                            }
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Documents
                        </Button>
                      </div>
                    
                  </GlassCard>
                ))
              )}
            </div>
          </TabsContent>
          <TabsContent value="email">
            <EmailAnalytics />
          </TabsContent>
        </Tabs>

        {/* Bulk Action Dialog */}
        <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Bulk {bulkAction === 'approve' ? 'Approve' : 'Reject'} ({selectedVerifications.size} verifications)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You are about to {bulkAction} {selectedVerifications.size} verification request(s). This action cannot be undone.
              </p>
              {bulkAction === 'reject' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Rejection Reason *</label>
                  <Select value={bulkRejectionReason} onValueChange={setBulkRejectionReason}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poor_quality">Poor Document Quality</SelectItem>
                      <SelectItem value="face_mismatch">Face Mismatch</SelectItem>
                      <SelectItem value="suspected_fake">Suspected Fake/Tampering</SelectItem>
                      <SelectItem value="unclear_selfie">Unclear Selfie</SelectItem>
                      <SelectItem value="expired_document">Expired Document</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button className="rounded-xl" variant="outline" onClick={() => setShowBulkDialog(false)} disabled={processing}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkAction} 
                disabled={processing || (bulkAction === 'reject' && !bulkRejectionReason)}
                className={bulkAction === 'approve' ? 'bg-success hover:bg-success/90' : ''}
                variant={bulkAction === 'reject' ? 'destructive' : 'default'}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : bulkAction === 'approve' ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Confirm {bulkAction === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
}
