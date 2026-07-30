import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeAdminOperation } from "@/lib/adminOperations";

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

export function useAdminDashboard() {
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

  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [fraudFilterStatus, setFraudFilterStatus] = useState("pending");
  const [fraudSearchQuery, setFraudSearchQuery] = useState("");

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
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).in('status', ['paid', 'active', 'approved']),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('reports').select('*', { count: 'exact', head: true }).neq('status', 'dismissed'),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('is_disputed', true).or('dispute_status.is.null,dispute_status.eq.open'),
        supabase.from('payments').select('platform_fee').eq('status', 'paid'),
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

  return {
    loading,
    stats,
    activeTab,
    setActiveTab,
    fraudAlerts,
    fraudFilterStatus,
    setFraudFilterStatus,
    fraudSearchQuery,
    setFraudSearchQuery,
    handleFraudAlertAction,
    verifications,
    verificationFilterStatus,
    setVerificationFilterStatus,
    verificationSearchQuery,
    setVerificationSearchQuery,
    selectedVerifications,
    toggleVerificationSelection,
    selectAllVerifications,
    clearSelection,
    showBulkDialog,
    setShowBulkDialog,
    bulkAction,
    setBulkAction,
    bulkRejectionReason,
    setBulkRejectionReason,
    processing,
    handleBulkAction,
    filteredFraudAlerts,
    filteredVerifications,
    fetchAllData,
  };
}
