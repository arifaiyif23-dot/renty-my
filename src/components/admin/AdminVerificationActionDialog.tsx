import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface AdminVerificationActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: 'approve' | 'reject' | null;
  rejectionReason: string;
  onRejectionReasonChange: (val: string) => void;
  adminNotes: string;
  onAdminNotesChange: (val: string) => void;
  processing: boolean;
  onConfirm: () => void;
}

export function AdminVerificationActionDialog({
  open,
  onOpenChange,
  actionType,
  rejectionReason,
  onRejectionReasonChange,
  adminNotes,
  onAdminNotesChange,
  processing,
  onConfirm,
}: AdminVerificationActionDialogProps) {
  if (!actionType) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Select value={rejectionReason} onValueChange={onRejectionReasonChange}>
                <SelectTrigger className="rounded-lg">
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
              onChange={(e) => onAdminNotesChange(e.target.value)}
              placeholder="Add any internal notes about this verification..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button className="rounded-lg" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={processing || (actionType === 'reject' && !rejectionReason)}
            variant={actionType === 'approve' ? 'success' : actionType === 'reject' ? 'destructive' : 'default'}
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
  );
}
