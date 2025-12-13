import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import { CheckCircle, XCircle, Loader2, Eye, Search, Filter, AlertTriangle, ShieldAlert, Brain, Sparkles, RefreshCw, Keyboard } from "lucide-react";
import Header from "@/components/Header";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIAnalysisCard } from "@/components/AIAnalysisCard";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { useAdminKeyboardShortcuts } from "@/hooks/use-admin-keyboard-shortcuts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

interface FraudAlert {
  id: string;
  user_id: string;
  alert_type: string;
  risk_score: number;
  status: string;
  details: any;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

interface DashboardStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  highRiskCount: number;
  avgConfidenceScore: number;
  aiSuggestedApprove: number;
}

export default function AdminVerification() {
  const { user } = useAuth();
  const { stats: realtimeStats, connectionState, resetStats } = useAdminRealtime();
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<VerificationRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDocType, setFilterDocType] = useState("all");
  const [filterRiskLevel, setFilterRiskLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("verifications");
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  useEffect(() => {
    fetchData();
    // Reset notification counters when viewing the page
    resetStats();
  }, [filterStatus, filterDocType, filterRiskLevel]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch verifications without profile join
      const { data: verificationsData, error: verError } = await supabase
        .from('verification_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (verError) {
        console.error("Verification fetch error:", verError);
        throw verError;
      }

      // Fetch fraud alerts without profile join
      const { data: fraudData, error: fraudError } = await supabase
        .from('fraud_alerts')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (fraudError) {
        console.error("Fraud alert fetch error:", fraudError);
        throw fraudError;
      }

      // Fetch all unique user profiles
      const userIds = [
        ...(verificationsData?.map(v => v.user_id) || []),
        ...(fraudData?.map(f => f.user_id) || [])
      ].filter((id): id is string => id !== null);
      
      const uniqueUserIds = [...new Set(userIds)];

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueUserIds);

      const profileMap = new Map(
        profilesData?.map(p => [p.id, p.full_name]) || []
      );

      // Map verifications with profile names
      const verificationsWithProfiles = verificationsData?.map(v => ({
        ...v,
        profiles: { full_name: profileMap.get(v.user_id) || 'Unknown User' }
      })) || [];

      // Map fraud alerts with profile names
      const fraudWithProfiles = fraudData?.map(f => ({
        ...f,
        profiles: { full_name: profileMap.get(f.user_id || '') || 'Unknown User' }
      })) || [];

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const pending = verificationsWithProfiles?.filter(v => v.status === 'pending').length || 0;
      const approvedToday = verificationsWithProfiles?.filter(v => 
        v.status === 'approved' && new Date(v.verified_at || '') >= today
      ).length || 0;
      const rejectedToday = verificationsWithProfiles?.filter(v => 
        v.status === 'rejected' && new Date(v.verified_at || '') >= today
      ).length || 0;
      const highRisk = verificationsWithProfiles?.filter(v => 
        v.fraud_risk_score && v.fraud_risk_score > 50
      ).length || 0;
      const aiSuggestedApprove = verificationsWithProfiles?.filter(v => 
        v.status === 'pending' && 
        (v.ai_analysis_result as any)?.autoApprove === true
      ).length || 0;
      const avgScore = verificationsWithProfiles?.reduce((acc, v) => 
        acc + (v.overall_confidence_score || 0), 0
      ) / (verificationsWithProfiles?.length || 1);

      setStats({
        pendingCount: pending,
        approvedToday,
        rejectedToday,
        highRiskCount: highRisk,
        avgConfidenceScore: Math.round(avgScore),
        aiSuggestedApprove
      });

      // Apply filters
      let filtered = verificationsWithProfiles || [];
      if (filterStatus === "ai_suggested") {
        filtered = filtered.filter(v => 
          v.status === 'pending' && 
          (v.ai_analysis_result as any)?.autoApprove === true
        );
      } else if (filterStatus !== "all") {
        filtered = filtered.filter(v => v.status === filterStatus);
      }
      if (filterDocType !== "all") {
        filtered = filtered.filter(v => v.document_type === filterDocType);
      }
      if (filterRiskLevel === "high") {
        filtered = filtered.filter(v => v.fraud_risk_score && v.fraud_risk_score > 50);
      } else if (filterRiskLevel === "low") {
        filtered = filtered.filter(v => !v.fraud_risk_score || v.fraud_risk_score <= 50);
      }

      setVerifications(filtered);
      setFraudAlerts(fraudWithProfiles);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedVerification || !actionType) return;

    if (actionType === 'reject' && !rejectionReason) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(true);

    try {
      const updateData: any = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
      };

      if (actionType === 'reject') {
        updateData.rejection_reason = rejectionReason;
      }

      if (adminNotes) {
        updateData.admin_notes = adminNotes;
      }

      const { error: updateError } = await (supabase as any)
        .from('verification_requests')
        .update(updateData)
        .eq('id', selectedVerification.id);

      if (updateError) throw updateError;

      // Create notification
      await (supabase as any).from('notifications').insert({
        user_id: selectedVerification.user_id,
        type: actionType === 'approve' ? 'verification_approved' : 'verification_rejected',
        title: actionType === 'approve' ? 'Verification Approved!' : 'Verification Rejected',
        message: actionType === 'approve' 
          ? 'Your identity has been verified successfully.' 
          : `Your verification was rejected: ${rejectionReason}`,
        link: '/profile'
      });

      // Create audit log
      await (supabase as any).from('verification_audit_log').insert({
        verification_id: selectedVerification.id,
        action: actionType === 'approve' ? 'approved' : 'rejected',
        performed_by: user?.id,
        details: {
          rejection_reason: rejectionReason,
          admin_notes: adminNotes
        }
      });

      toast.success(`Verification ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowDialog(false);
      setSelectedVerification(null);
      setActionType(null);
      setRejectionReason("");
      setAdminNotes("");
      fetchData();
    } catch (error) {
      console.error("Error processing verification:", error);
      toast.error("Failed to process verification");
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select verifications to approve");
      return;
    }

    setProcessing(true);
    try {
      const updates = Array.from(selectedIds).map(id => 
        (supabase as any)
          .from('verification_requests')
          .update({
            status: 'approved',
            verified_by: user?.id,
            verified_at: new Date().toISOString()
          })
          .eq('id', id)
      );

      await Promise.all(updates);

      // Create notifications
      const notifications = Array.from(selectedIds).map(id => {
        const verification = verifications.find(v => v.id === id);
        return (supabase as any).from('notifications').insert({
          user_id: verification?.user_id,
          type: 'verification_approved',
          title: 'Verification Approved!',
          message: 'Your identity has been verified successfully.',
          link: '/profile'
        });
      });

      await Promise.all(notifications);

      toast.success(`${selectedIds.size} verifications approved successfully`);
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error("Batch approval error:", error);
      toast.error("Failed to approve verifications");
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVerifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVerifications.map(v => v.id)));
    }
  };

  const openActionDialog = (verification: VerificationRequest, type: 'approve' | 'reject') => {
    setSelectedVerification(verification);
    setActionType(type);
    setShowDialog(true);
  };

  const openDocViewer = (verification: VerificationRequest, index: number) => {
    setSelectedVerification(verification);
    setSelectedIndex(index);
    setShowDocViewer(true);
  };

  const filteredVerifications = verifications.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.full_name_on_document?.toLowerCase().includes(query) ||
      v.ic_number?.toLowerCase().includes(query) ||
      v.profiles?.full_name?.toLowerCase().includes(query)
    );
  });

  // Get pending verifications for keyboard navigation
  const pendingVerifications = filteredVerifications.filter(v => v.status === 'pending');
  const currentPendingVerification = selectedIndex >= 0 && selectedIndex < pendingVerifications.length 
    ? pendingVerifications[selectedIndex] 
    : null;

  // Keyboard shortcuts
  useAdminKeyboardShortcuts({
    onApprove: currentPendingVerification ? () => openActionDialog(currentPendingVerification, 'approve') : undefined,
    onReject: currentPendingVerification ? () => openActionDialog(currentPendingVerification, 'reject') : undefined,
    onViewDocuments: currentPendingVerification ? () => openDocViewer(currentPendingVerification, selectedIndex) : undefined,
    onNextItem: () => {
      if (pendingVerifications.length > 0) {
        const newIndex = selectedIndex < pendingVerifications.length - 1 ? selectedIndex + 1 : 0;
        setSelectedIndex(newIndex);
        setSelectedVerification(pendingVerifications[newIndex]);
      }
    },
    onPrevItem: () => {
      if (pendingVerifications.length > 0) {
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : pendingVerifications.length - 1;
        setSelectedIndex(newIndex);
        setSelectedVerification(pendingVerifications[newIndex]);
      }
    },
    onRefresh: fetchData,
    enabled: activeTab === 'verifications' && !showDialog && !showDocViewer
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Verification & Security Dashboard</h1>
            <p className="text-muted-foreground">Review verifications, manage fraud alerts, and approve users</p>
          </div>
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}>
                    <Keyboard className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <p className="font-semibold mb-2">Keyboard Shortcuts</p>
                    <p><kbd className="bg-muted px-1 rounded">A</kbd> Approve selected</p>
                    <p><kbd className="bg-muted px-1 rounded">R</kbd> Reject selected</p>
                    <p><kbd className="bg-muted px-1 rounded">V</kbd> View documents</p>
                    <p><kbd className="bg-muted px-1 rounded">↑/K</kbd> Previous item</p>
                    <p><kbd className="bg-muted px-1 rounded">↓/J</kbd> Next item</p>
                    <p><kbd className="bg-muted px-1 rounded">Shift+R</kbd> Refresh</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {connectionState === 'connected' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span>Live Updates Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-3xl">{stats.pendingCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className={stats.aiSuggestedApprove > 0 ? "border-green-500/50 bg-green-500/5" : ""}>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Suggested
                </CardDescription>
                <CardTitle className="text-3xl text-green-600">{stats.aiSuggestedApprove}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Approved Today</CardDescription>
                <CardTitle className="text-3xl text-green-600">{stats.approvedToday}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Rejected Today</CardDescription>
                <CardTitle className="text-3xl text-red-600">{stats.rejectedToday}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>High Risk</CardDescription>
                <CardTitle className="text-3xl text-orange-600">{stats.highRiskCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Avg Confidence</CardDescription>
                <CardTitle className="text-3xl">{stats.avgConfidenceScore}%</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="verifications">
              Verifications ({stats?.pendingCount || 0})
            </TabsTrigger>
            <TabsTrigger value="fraud">
              Fraud Alerts ({fraudAlerts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verifications">
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or IC number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="ai_suggested">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI Suggested
                        </span>
                      </SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterDocType} onValueChange={setFilterDocType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Document Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="mykad">MyKad</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving_license">Driving License</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
                    <SelectTrigger className="w-[200px]">
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Risk Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 flex-wrap">
                    {stats && stats.aiSuggestedApprove > 0 && filterStatus !== 'ai_suggested' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFilterStatus('ai_suggested')}
                        className="border-green-500/50 text-green-600 hover:bg-green-500/10"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        View {stats.aiSuggestedApprove} AI Suggested
                      </Button>
                    )}
                    {selectedIds.size > 0 && (
                      <>
                        <Badge variant="secondary">{selectedIds.size} selected</Badge>
                        <Button
                          size="sm"
                          onClick={handleBatchApprove}
                          disabled={processing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {processing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Batch Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          Clear Selection
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verifications List */}
            {filteredVerifications.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredVerifications.length && filteredVerifications.length > 0}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All
                </label>
              </div>
            )}
            
            <div className="grid gap-4">
              {filteredVerifications.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No verification requests found
                  </CardContent>
                </Card>
              ) : (
                filteredVerifications.map((verification) => (
                  <Card key={verification.id} className={verification.fraud_risk_score && verification.fraud_risk_score > 50 ? 'border-orange-500' : ''}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        {verification.status === 'pending' && (
                          <Checkbox
                            checked={selectedIds.has(verification.id)}
                            onCheckedChange={() => toggleSelection(verification.id)}
                            className="mt-1"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                {verification.full_name_on_document}
                                {verification.fraud_risk_score && verification.fraud_risk_score > 50 && (
                                  <Badge variant="destructive" className="ml-2">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    High Risk
                                  </Badge>
                                )}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                User: {verification.profiles?.full_name} | Submitted: {format(new Date(verification.created_at), "MMM dd, yyyy HH:mm")}
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

                  {/* AI Analysis Results */}
                  {verification.ai_analysis_result ? (
                    <div className="mb-4">
                      <AIAnalysisCard analysis={verification.ai_analysis_result} />
                    </div>
                  ) : verification.overall_confidence_score !== null ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Overall</p>
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
                    </div>
                  ) : (
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg flex items-center gap-2 text-muted-foreground">
                      <Brain className="h-5 w-5" />
                      <span className="text-sm">AI analysis not yet performed</span>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const index = pendingVerifications.findIndex(v => v.id === verification.id);
                        openDocViewer(verification, index >= 0 ? index : 0);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Documents (V)
                    </Button>
                    {verification.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openActionDialog(verification, 'approve')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openActionDialog(verification, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                  </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="fraud">
            <div className="grid gap-4">
              {fraudAlerts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No pending fraud alerts
                  </CardContent>
                </Card>
              ) : (
                fraudAlerts.map((alert) => (
                  <Card key={alert.id} className="border-red-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                            {alert.alert_type.replace(/_/g, ' ').toUpperCase()}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            User: {alert.profiles?.full_name} | {format(new Date(alert.created_at), "MMM dd, yyyy HH:mm")}
                          </p>
                        </div>
                        <Badge variant="destructive">Risk: {alert.risk_score}%</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg mb-4">
                        <p className="text-sm font-medium mb-2">Alert Details:</p>
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(alert.details, null, 2)}
                        </pre>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await (supabase as any)
                                .from('fraud_alerts')
                                .update({ status: 'reviewed', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
                                .eq('id', alert.id);
                              toast.success("Alert marked as reviewed");
                              fetchData();
                            } catch (error) {
                              toast.error("Failed to update alert");
                            }
                          }}
                        >
                          Mark as Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              await (supabase as any)
                                .from('fraud_alerts')
                                .update({ status: 'escalated', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
                                .eq('id', alert.id);
                              toast.success("Alert escalated");
                              fetchData();
                            } catch (error) {
                              toast.error("Failed to escalate alert");
                            }
                          }}
                        >
                          Escalate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' ? 'Approve Verification' : 'Reject Verification'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {actionType === 'reject' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Rejection Reason *</label>
                  <Select value={rejectionReason} onValueChange={setRejectionReason}>
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
              <div>
                <label className="text-sm font-medium mb-2 block">Admin Notes (Internal)</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any internal notes about this verification..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={processing}>
                Cancel
              </Button>
              <Button 
                onClick={handleAction} 
                disabled={processing || (actionType === 'reject' && !rejectionReason)}
                className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                variant={actionType === 'reject' ? 'destructive' : 'default'}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : actionType === 'approve' ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {actionType === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Document Viewer Modal */}
        <DocumentViewerModal
          open={showDocViewer}
          onOpenChange={setShowDocViewer}
          verification={selectedVerification}
          onApprove={selectedVerification?.status === 'pending' ? () => {
            setShowDocViewer(false);
            openActionDialog(selectedVerification!, 'approve');
          } : undefined}
          onReject={selectedVerification?.status === 'pending' ? () => {
            setShowDocViewer(false);
            openActionDialog(selectedVerification!, 'reject');
          } : undefined}
        />
      </div>
    </>
  );
}
