import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeAdminOperation } from "@/lib/adminOperations";

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
  ai_analysis_result: AiAnalysisResult | null;
  created_at: string;
  profiles: { full_name: string };
}

interface UseAdminVerificationActionsOptions {
  onSuccess: () => void;
}

export function useAdminVerificationActions({ onSuccess }: UseAdminVerificationActionsOptions) {
  const [selectedVerification, setSelectedVerification] = useState<VerificationRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleAction = async () => {
    if (!selectedVerification || !actionType) return;

    if (actionType === 'reject' && !rejectionReason) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(true);

    try {
      await invokeAdminOperation({
        action: 'verify_identity',
        verificationId: selectedVerification.id,
        status: actionType === 'approve' ? 'approved' : 'rejected',
        userId: selectedVerification.user_id,
        rejectionReason: rejectionReason || undefined,
        adminNotes: adminNotes || undefined,
      });

      try {
        await supabase.functions.invoke('send-verification-email', {
          body: {
            userId: selectedVerification.user_id,
            status: actionType === 'approve' ? 'approved' : 'rejected',
            rejectionReason: rejectionReason
          }
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      toast.success(`Verification ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowDialog(false);
      setSelectedVerification(null);
      setActionType(null);
      setRejectionReason("");
      setAdminNotes("");
      onSuccess();
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
      await invokeAdminOperation({
        action: 'batch_verify_identity',
        ids: Array.from(selectedIds),
        status: 'approved',
      });

      toast.success(`${selectedIds.size} verifications approved successfully`);
      setSelectedIds(new Set());
      onSuccess();
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
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
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

  return {
    selectedVerification,
    setSelectedVerification,
    showDialog,
    setShowDialog,
    actionType,
    rejectionReason,
    setRejectionReason,
    adminNotes,
    setAdminNotes,
    selectedIds,
    processing,
    showDocViewer,
    setShowDocViewer,
    selectedIndex,
    handleAction,
    handleBatchApprove,
    toggleSelection,
    toggleSelectAll,
    openActionDialog,
    openDocViewer,
  };
}
