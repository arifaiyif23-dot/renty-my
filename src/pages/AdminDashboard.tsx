import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Mail
} from "lucide-react";
import Header from "@/components/Header";
import EmailAnalytics from "@/components/EmailAnalytics";
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
  details: any;
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
  ic_number: string | null;
  date_of_birth: string | null;
  document_quality_score: number | null;
  face_match_score: number | null;
  liveness_score: number | null;
  overall_confidence_score: number | null;
  fraud_risk_score: number | null;
  ai_analysis_result: any;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

interface DashboardStats {
  pendingVerifications: number;
  pendingFraudAlerts: number;
  totalVerifications: number;
  approvalRate: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    pendingVerifications: 0,
    pendingFraudAlerts: 0,
    totalVerifications: 0,
    approvalRate: 0
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
  }, []);

  useEffect(() => {
    if (activeTab === "fraud-alerts") {
      fetchFraudAlerts();
    } else if (activeTab === "verifications") {
      fetchVerifications();
    }
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
      // Get pending verifications count
      const { count: pendingCount } = await (supabase as any)
        .from('verification_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get pending fraud alerts count
      const { count: fraudCount } = await (supabase as any)
        .from('fraud_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get total verifications
      const { count: totalCount } = await (supabase as any)
        .from('verification_requests')
        .select('*', { count: 'exact', head: true });

      // Get approved verifications
      const { count: approvedCount } = await (supabase as any)
        .from('verification_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');

      const approvalRate = totalCount ? ((approvedCount || 0) / totalCount) * 100 : 0;

      setStats({
        pendingVerifications: pendingCount || 0,
        pendingFraudAlerts: fraudCount || 0,
        totalVerifications: totalCount || 0,
        approvalRate: Math.round(approvalRate)
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchFraudAlerts = async () => {
    try {
      let query = (supabase as any)
        .from('fraud_alerts')
        .select(`
          *,
          profiles(full_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (fraudFilterStatus !== "all") {
        query = query.eq('status', fraudFilterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      setFraudAlerts(data || []);
    } catch (error) {
      console.error("Error fetching fraud alerts:", error);
      toast.error("Failed to load fraud alerts");
    }
  };

  const fetchVerifications = async () => {
    try {
      let query = (supabase as any)
        .from('verification_requests')
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .order('created_at', { ascending: false });

      if (verificationFilterStatus !== "all") {
        query = query.eq('status', verificationFilterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      setVerifications(data || []);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      toast.error("Failed to load verifications");
    }
  };

  const handleFraudAlertAction = async (alertId: string, action: 'reviewed' | 'dismissed') => {
    try {
      const { error } = await (supabase as any)
        .from('fraud_alerts')
        .update({
          status: action,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

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
      
      // Update all selected verifications
      const updateData: any = {
        status: bulkAction === 'approve' ? 'approved' : 'rejected',
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
      };

      if (bulkAction === 'reject') {
        updateData.rejection_reason = bulkRejectionReason;
      }

      const { error: updateError } = await (supabase as any)
        .from('verification_requests')
        .update(updateData)
        .in('id', verificationIds);

      if (updateError) throw updateError;

      // Create notifications for each user
      const verificationsToNotify = verifications.filter(v => 
        selectedVerifications.has(v.id)
      );

      const notifications = verificationsToNotify.map(v => ({
        user_id: v.user_id,
        type: bulkAction === 'approve' ? 'verification_approved' : 'verification_rejected',
        title: bulkAction === 'approve' ? 'Verification Approved!' : 'Verification Rejected',
        message: bulkAction === 'approve' 
          ? 'Your identity has been verified successfully.' 
          : `Your verification was rejected: ${bulkRejectionReason}`,
        link: '/profile'
      }));

      await (supabase as any).from('notifications').insert(notifications);

      // Create audit logs
      const auditLogs = verificationIds.map(id => ({
        verification_id: id,
        action: bulkAction === 'approve' ? 'bulk_approved' : 'bulk_rejected',
        performed_by: user?.id,
        details: {
          rejection_reason: bulkRejectionReason,
          bulk_count: verificationIds.length
        }
      }));

      await (supabase as any).from('verification_audit_log').insert(auditLogs);

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
      v.ic_number?.toLowerCase().includes(query) ||
      v.profiles?.full_name?.toLowerCase().includes(query)
    );
  });

  const getRiskBadge = (score: number) => {
    if (score >= 80) return <Badge variant="destructive">Critical Risk ({score}%)</Badge>;
    if (score >= 60) return <Badge className="bg-orange-500">High Risk ({score}%)</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500">Medium Risk ({score}%)</Badge>;
    return <Badge variant="secondary">Low Risk ({score}%)</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-7xl pb-mobile-nav">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage verifications, fraud alerts, and platform security</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/health" className="text-sm px-3 py-1.5 rounded-md border bg-card hover:bg-accent">System Health</a>
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
                <Badge className="ml-2" variant="destructive">{stats.pendingFraudAlerts}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verifications">
              <Shield className="h-4 w-4 mr-2" />
              Verifications
              {stats.pendingVerifications > 0 && (
                <Badge className="ml-2" variant="secondary">{stats.pendingVerifications}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingVerifications}</div>
                  <p className="text-xs text-muted-foreground">Require review</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingFraudAlerts}</div>
                  <p className="text-xs text-muted-foreground">Need attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalVerifications}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.approvalRate}%</div>
                  <p className="text-xs text-muted-foreground">Success rate</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab("verifications")}
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    Review Pending Verifications ({stats.pendingVerifications})
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab("fraud-alerts")}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Check Fraud Alerts ({stats.pendingFraudAlerts})
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={fetchAllData}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Dashboard
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Platform activity and security monitoring
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Fraud Alerts Tab */}
          <TabsContent value="fraud-alerts" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search fraud alerts..."
                        value={fraudSearchQuery}
                        onChange={(e) => setFraudSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={fraudFilterStatus} onValueChange={setFraudFilterStatus}>
                    <SelectTrigger className="w-full md:w-[200px]">
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
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {filteredFraudAlerts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No fraud alerts found
                  </CardContent>
                </Card>
              ) : (
                filteredFraudAlerts.map((alert) => (
                  <Card key={alert.id} className="border-l-4 border-l-destructive">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg capitalize">{alert.alert_type.replace(/_/g, ' ')}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            User: {alert.profiles?.full_name} | {format(new Date(alert.created_at), "MMM dd, yyyy HH:mm")}
                          </p>
                        </div>
                        {getRiskBadge(alert.risk_score)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">Details:</p>
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(alert.details, null, 2)}
                          </pre>
                        </div>
                        {alert.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleFraudAlertAction(alert.id, 'reviewed')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Reviewed
                            </Button>
                            <Button
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
                          <Badge variant="secondary">
                            Status: {alert.status}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Verifications Tab */}
          <TabsContent value="verifications" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or IC number..."
                          value={verificationSearchQuery}
                          onChange={(e) => setVerificationSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={verificationFilterStatus} onValueChange={setVerificationFilterStatus}>
                      <SelectTrigger className="w-full md:w-[200px]">
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
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Bulk Approve
                      </Button>
                      <Button 
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
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                    </div>
                  )}

                  {verificationFilterStatus === 'pending' && filteredVerifications.some(v => v.status === 'pending') && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={selectAllVerifications}
                    >
                      Select All Pending
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {filteredVerifications.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No verification requests found
                  </CardContent>
                </Card>
              ) : (
                filteredVerifications.map((verification) => (
                  <Card key={verification.id}>
                    <CardHeader>
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
                              <CardTitle className="text-lg">{verification.full_name_on_document}</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                User: {verification.profiles?.full_name} | {format(new Date(verification.created_at), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                            {getStatusBadge(verification.status)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Document Type</p>
                          <p className="text-sm text-muted-foreground capitalize">{verification.document_type}</p>
                        </div>
                        {verification.ic_number && (
                          <div>
                            <p className="text-sm font-medium mb-1">IC Number</p>
                            <p className="text-sm text-muted-foreground">{verification.ic_number.slice(0, 6)}**-****</p>
                          </div>
                        )}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const frontUrl = await getSignedUrl(verification.document_front_url);
                              window.open(frontUrl, '_blank');
                              
                              if (verification.document_back_url) {
                                const backUrl = await getSignedUrl(verification.document_back_url);
                                window.open(backUrl, '_blank');
                              }
                              
                              const selfieUrl = await getSignedUrl(verification.selfie_url);
                              window.open(selfieUrl, '_blank');
                            } catch (error) {
                              toast.error("Failed to load documents");
                            }
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Documents
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
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
                    <SelectTrigger>
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
              <Button variant="outline" onClick={() => setShowBulkDialog(false)} disabled={processing}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkAction} 
                disabled={processing || (bulkAction === 'reject' && !bulkRejectionReason)}
                className={bulkAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
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

        {/* Email Tab */}
        <TabsContent value="email">
          <EmailAnalytics />
        </TabsContent>
      </div>
    </>
  );
}
