import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";

interface AiAnalysisResult {
  autoApprove?: boolean;
  confidence?: number;
  [key: string]: unknown;
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
  verified_at?: string;
  ai_analysis_result: AiAnalysisResult | null;
  created_at: string;
  profiles: { full_name: string };
}

interface FraudAlert {
  id: string;
  user_id: string;
  alert_type: string;
  risk_score: number;
  status: string;
  details: Record<string, unknown>;
  created_at: string;
  profiles: { full_name: string };
}

interface DashboardStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  highRiskCount: number;
  avgConfidenceScore: number;
}

export function useAdminVerificationData() {
  const { connectionState, resetStats } = useAdminRealtime();
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDocType, setFilterDocType] = useState("all");
  const [filterRiskLevel, setFilterRiskLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData(true);
    resetStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterDocType, filterRiskLevel]);

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const { data: verificationsData, error: verError } = await supabase
        .from('verification_requests')
        .select('id, user_id, document_type, full_name_on_document, date_of_birth, status, created_at, updated_at, verified_at, rejection_reason, document_quality_score, face_match_score, liveness_score, overall_confidence_score, fraud_risk_score, ai_analysis_result, document_front_url, document_back_url, selfie_url')
        .order('created_at', { ascending: false });

      if (verError) throw verError;

      const { data: fraudData, error: fraudError } = await supabase
        .from('fraud_alerts')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (fraudError) throw fraudError;

      const userIds = [
        ...(verificationsData?.map(v => v.user_id) || []),
        ...(fraudData?.map(f => f.user_id) || [])
      ].filter((id): id is string => id !== null);

      const uniqueUserIds = [...new Set(userIds)];

      const { data: profilesData } = uniqueUserIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', uniqueUserIds)
        : { data: [] };

      const profileMap = new Map<string, string>(
        (profilesData || []).map(p => [p.id, p.full_name])
      );

      const verificationsWithProfiles: VerificationRequest[] = (verificationsData || []).map(v => ({
        ...v,
        profiles: { full_name: profileMap.get(v.user_id) || 'Unknown User' }
      }));

      const fraudWithProfiles: FraudAlert[] = (fraudData || []).map(f => ({
        ...f,
        profiles: { full_name: profileMap.get(f.user_id || '') || 'Unknown User' }
      }));

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const pending = verificationsWithProfiles.filter(v => v.status === 'pending').length;
      const approvedToday = verificationsWithProfiles.filter(v =>
        v.status === 'approved' && new Date(v.verified_at || '') >= today
      ).length;
      const rejectedToday = verificationsWithProfiles.filter(v =>
        v.status === 'rejected' && new Date(v.verified_at || '') >= today
      ).length;
      const highRisk = verificationsWithProfiles.filter(v =>
        v.fraud_risk_score && v.fraud_risk_score > 50
      ).length;

      const avgScore = verificationsWithProfiles.reduce((acc, v) =>
        acc + (v.overall_confidence_score || 0), 0
      ) / (verificationsWithProfiles.length || 1);

      setStats({
        pendingCount: pending,
        approvedToday,
        rejectedToday,
        highRiskCount: highRisk,
        avgConfidenceScore: Math.round(avgScore),
      });

      let filtered = verificationsWithProfiles;
      if (filterStatus !== "all") {
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
      setRefreshing(false);
    }
  };

  const filteredVerifications = verifications.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.full_name_on_document?.toLowerCase().includes(query) ||
      v.profiles?.full_name?.toLowerCase().includes(query)
    );
  });

  const pendingVerifications = filteredVerifications.filter(v => v.status === 'pending');

  return {
    connectionState,
    verifications: filteredVerifications,
    pendingVerifications,
    fraudAlerts,
    stats,
    loading,
    refreshing,
    filterStatus,
    setFilterStatus,
    filterDocType,
    setFilterDocType,
    filterRiskLevel,
    setFilterRiskLevel,
    searchQuery,
    setSearchQuery,
    refresh: fetchData,
  };
}

export type { VerificationRequest, FraudAlert, DashboardStats, AiAnalysisResult };
