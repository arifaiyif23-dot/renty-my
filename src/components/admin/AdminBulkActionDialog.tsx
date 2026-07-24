import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface AdminBulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: 'approve' | 'reject' | null;
  selectedCount: number;
  rejectionReason: string;
  onRejectionReasonChange: (val: string) => void;
  processing: boolean;
  onConfirm: () => void;
}

export function AdminBulkActionDialog({
  open,
  onOpenChange,
  action,
  selectedCount,
  rejectionReason,
  onRejectionReasonChange,
  processing,
  onConfirm,
}: AdminBulkActionDialogProps) {
  if (!action) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Bulk {action === 'approve' ? 'Approve' : 'Reject'} ({selectedCount} verifications)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are about to {action} {selectedCount} verification request(s). This action cannot be undone.
          </p>
          {action === 'reject' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Rejection Reason *</label>
              <Select value={rejectionReason} onValueChange={onRejectionReasonChange}>
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
          <Button className="rounded-xl" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={processing || (action === 'reject' && !rejectionReason)}
            className={action === 'approve' ? 'bg-success hover:bg-success/90' : ''}
            variant={action === 'reject' ? 'destructive' : 'default'}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : action === 'approve' ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Confirm {action === 'approve' ? 'Approval' : 'Rejection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
