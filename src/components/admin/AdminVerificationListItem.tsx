import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from '@/components/ui/GlassCard';
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, XCircle, AlertTriangle, Eye, Brain, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { AIAnalysisCard } from "@/components/AIAnalysisCard";

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

interface AdminVerificationListItemProps {
  verification: VerificationRequest;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  onApprove: (v: VerificationRequest) => void;
  onReject: (v: VerificationRequest) => void;
  onViewDocuments: (v: VerificationRequest, idx: number) => void;
  pendingIndex: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge className="rounded-full" variant="secondary">Pending Review</Badge>;
    case 'processing':
      return <Badge className="rounded-full" variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
    case 'approved':
      return <Badge className="bg-success rounded-full"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    case 'rejected':
      return <Badge className="rounded-full" variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge className="rounded-full">{status}</Badge>;
  }
}

export function AdminVerificationListItem({
  verification,
  selected,
  onToggleSelection,
  onApprove,
  onReject,
  onViewDocuments,
  pendingIndex,
}: AdminVerificationListItemProps) {
  const isHighRisk = verification.fraud_risk_score && verification.fraud_risk_score > 50;

  return (
    <GlassCard className={isHighRisk ? 'border-warning' : ''}>
      <div className="flex items-start gap-4 mb-4">
        {verification.status === 'pending' && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelection(verification.id)}
            className="mt-1"
          />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">
                {verification.full_name_on_document}
                {isHighRisk && (
                  <Badge variant="destructive" className="ml-2 rounded-full">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    High Risk
                  </Badge>
                )}
              </h4>
              <p className="text-sm text-muted-foreground">
                User: {verification.profiles?.full_name} | Submitted: {format(new Date(verification.created_at), "MMM dd, yyyy HH:mm")}
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
          <span className="text-sm">Pending manual review</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg"
          onClick={() => onViewDocuments(verification, pendingIndex)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Documents (V)
        </Button>
        {verification.status === 'pending' && (
          <>
            <Button
              size="sm"
              variant="success"
              onClick={() => onApprove(verification)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onReject(verification)}
              className="rounded-lg"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </>
        )}
      </div>
    </GlassCard>
  );
}
