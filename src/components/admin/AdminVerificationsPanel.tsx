import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, CheckCircle, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { getSignedUrl } from "@/utils/signedUrls";
import { toast } from "sonner";

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

interface AdminVerificationsPanelProps {
  verifications: VerificationRequest[];
  filterStatus: string;
  onFilterStatusChange: (val: string) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  selectedVerifications: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
}

function getStatusBadge(status: string) {
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
}

function extractStoragePath(url: string): string {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public\/)?verification-documents\/(.+)$/);
    if (match) return `verification-documents/${match[1]}`;
  } catch {}
  if (url.startsWith('verification-documents/')) return url;
  return `verification-documents/${url}`;
}

export function AdminVerificationsPanel({
  verifications,
  filterStatus,
  onFilterStatusChange,
  searchQuery,
  onSearchQueryChange,
  selectedVerifications,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onBulkApprove,
  onBulkReject,
}: AdminVerificationsPanelProps) {
  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or IC number..."
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  className="rounded-xl pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={onFilterStatusChange}>
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

          {selectedVerifications.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedVerifications.size} selected
              </span>
              <Button size="sm" onClick={onBulkApprove} className="rounded-xl bg-success hover:bg-success/90">
                <CheckCircle className="h-4 w-4 mr-2" />
                Bulk Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={onBulkReject} className="rounded-xl">
                <XCircle className="h-4 w-4 mr-2" />
                Bulk Reject
              </Button>
              <Button size="sm" variant="outline" onClick={onClearSelection} className="rounded-xl">
                Clear
              </Button>
            </div>
          )}

          {filterStatus === 'pending' && verifications.some(v => v.status === 'pending') && (
            <Button variant="outline" size="sm" onClick={onSelectAll} className="rounded-xl w-fit">
              Select All Pending
            </Button>
          )}
        </div>
      </GlassCard>

      <div className="grid gap-4">
        {verifications.length === 0 ? (
          <GlassCard>
            <p className="text-center text-muted-foreground">No verification requests found</p>
          </GlassCard>
        ) : (
          verifications.map((verification) => (
            <GlassCard key={verification.id}>
              <div className="flex items-start gap-4 mb-4">
                {verification.status === 'pending' && (
                  <Checkbox
                    checked={selectedVerifications.has(verification.id)}
                    onCheckedChange={() => onToggleSelection(verification.id)}
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{verification.full_name_on_document}</h4>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    // Open windows synchronously to avoid popup blockers
                    const frontWin = verification.document_front_url ? window.open('', '_blank') : null;
                    const backWin = verification.document_back_url ? window.open('', '_blank') : null;
                    const selfieWin = verification.selfie_url ? window.open('', '_blank') : null;
                    (async () => {
                      try {
                        if (frontWin && verification.document_front_url) {
                          const url = await getSignedUrl(extractStoragePath(verification.document_front_url));
                          frontWin.location.href = url;
                        }
                        if (backWin && verification.document_back_url) {
                          const url = await getSignedUrl(extractStoragePath(verification.document_back_url));
                          backWin.location.href = url;
                        }
                        if (selfieWin && verification.selfie_url) {
                          const url = await getSignedUrl(extractStoragePath(verification.selfie_url));
                          selfieWin.location.href = url;
                        }
                      } catch {
                        toast.error("Failed to load documents");
                      }
                    })();
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
    </div>
  );
}
