import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Eye, Search, Filter } from "lucide-react";
import Header from "@/components/Header";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  ai_analysis_result: any;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export default function AdminVerification() {
  const { user } = useAuth();
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<VerificationRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchVerifications();
  }, [filterStatus]);

  const fetchVerifications = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('verification_requests')
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .order('created_at', { ascending: false });

      let filtered = data || [];
      if (filterStatus !== "all") {
        filtered = filtered.filter((v: any) => v.status === filterStatus);
      }

      setVerifications(filtered);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      toast.error("Failed to load verifications");
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
      fetchVerifications();
    } catch (error) {
      console.error("Error processing verification:", error);
      toast.error("Failed to process verification");
    } finally {
      setProcessing(false);
    }
  };

  const openActionDialog = (verification: VerificationRequest, type: 'approve' | 'reject') => {
    setSelectedVerification(verification);
    setActionType(type);
    setShowDialog(true);
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Verification Management</h1>
          <p className="text-muted-foreground">Review and manage user verification requests</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
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
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Verifications List */}
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
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{verification.full_name_on_document}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        User: {verification.profiles?.full_name} | Submitted: {format(new Date(verification.created_at), "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                    {getStatusBadge(verification.status)}
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
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVerification(verification);
                        // Open images in new tabs for review
                        window.open(verification.document_front_url, '_blank');
                        if (verification.document_back_url) {
                          window.open(verification.document_back_url, '_blank');
                        }
                        window.open(verification.selfie_url, '_blank');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Documents
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
      </div>
    </>
  );
}
