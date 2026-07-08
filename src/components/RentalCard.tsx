import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReviewForm } from "@/components/ReviewForm";
import { RentalModificationDialog } from "@/components/RentalModificationDialog";
import { PayNowButton } from "@/components/PayNowButton";
import { HandoverDialog } from "@/components/HandoverDialog";
import { ReturnDisputeDialog } from "@/components/ReturnDisputeDialog";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, Calendar, DollarSign, Clock3, RotateCcw, Lock, Key, Camera, AlertTriangle, Loader2 } from "lucide-react";
import { Rental } from "@/types";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";

interface RentalCardProps {
  rental: Rental;
  isOwner: boolean;
  onStatusUpdate: (rentalId: string, status: Rental['status']) => Promise<void>;
  onReviewSuccess: () => void;
}

export function RentalCard({ rental, isOwner, onStatusUpdate, onReviewSuccess }: RentalCardProps) {
  const { t } = useTranslation();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject' | 'active' | 'complete' | null;
  }>({ open: false, action: null });
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [modificationDialog, setModificationDialog] = useState<{
    open: boolean;
    type: 'extension' | 'early_return' | null;
  }>({ open: false, type: null });
  const [handoverDialog, setHandoverDialog] = useState(false);
  const [returnDialog, setReturnDialog] = useState(false);

  const canReview = rental.status === 'completed';
  const revieweeId = isOwner ? rental.renter_id : rental.owner_id;

  const getStatusColor = (status: Rental['status']) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-500/30';
      case 'approved':
        return 'bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-500/30';
      case 'paid':
      case 'active':
        return 'bg-green-500/20 text-green-800 dark:text-green-400 border-green-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-500/30';
      case 'disputed':
        return 'bg-orange-500/20 text-orange-800 dark:text-orange-400 border-orange-500/30';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-500/20 text-red-800 dark:text-red-400 border-red-500/30';
      default:
        return '';
    }
  };

  const getStatusIcon = (status: Rental['status']) => {
    switch (status) {
      case 'pending_approval':
        return <Clock className="h-3 w-3" />;
      case 'approved':
        return <CheckCircle className="h-3 w-3" />;
      case 'paid':
      case 'active':
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'disputed':
        return <AlertTriangle className="h-3 w-3" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.action) return;

    const statusMap = {
      approve: 'approved' as Rental['status'],
      reject: 'rejected' as Rental['status'],
      active: 'active' as Rental['status'],
      complete: 'completed' as Rental['status'],
    };

    haptics.medium();
    setIsUpdating(true);
    try {
      await onStatusUpdate(rental.id, statusMap[confirmDialog.action]);
      haptics.success();
    } catch (error) {
      haptics.error();
    } finally {
      setIsUpdating(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  const getConfirmDialogContent = () => {
    switch (confirmDialog.action) {
      case 'approve':
        return {
          title: t('rental.approveTitle'),
          description: t('rental.approveDescription', { title: rental.item?.title }),
          confirmText: t('rental.approve'),
        };
      case 'reject':
        return {
          title: t('rental.rejectTitle'),
          description: t('rental.rejectDescription', { title: rental.item?.title }),
          confirmText: t('rental.decline'),
        };
      case 'active':
        return {
          title: t('rental.activeTitle'),
          description: t('rental.activeDescription', { title: rental.item?.title }),
          confirmText: t('rental.markActive'),
        };
      case 'complete':
        return {
          title: t('rental.completeTitle'),
          description: t('rental.completeDescription'),
          confirmText: t('rental.confirmCompletion'),
        };
      default:
        return { title: '', description: '', confirmText: '' };
    }
  };

  const dialogContent = getConfirmDialogContent();

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        {/* Mobile: Vertical Layout */}
        <div className="md:hidden">
          {rental.item?.images?.[0]?.image_url && (
            <div className="relative aspect-video">
              <img
                src={rental.item.images[0].image_url}
                alt={rental.item.title}
                className="object-cover w-full h-full"
              />
              <Badge className={`absolute top-2 left-2 gap-1 ${getStatusColor(rental.status)}`}>
                {getStatusIcon(rental.status)}
                {rental.status}
              </Badge>
            </div>
          )}
          
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-lg line-clamp-1">{rental.item?.title}</h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('rental.dates')}
                </p>
                <p className="font-medium text-xs leading-tight">
                  {format(new Date(rental.start_date), 'MMM d')} - {format(new Date(rental.end_date), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {t('rental.total')}
                </p>
                <p className="font-semibold text-lg">RM {rental.total_price}</p>
              </div>
            </div>

            <div className="text-sm pt-2 border-t">
              <p className="text-muted-foreground">{isOwner ? t('rental.renter') : t('rental.owner')}</p>
              <p className="font-medium">{isOwner ? rental.renter?.full_name : rental.owner?.full_name}</p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              {/* Renter: Pickup code for approved/paid rentals */}
              {!isOwner && (rental.status === 'approved' || rental.status === 'paid') && rental.pickup_code && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{t('rental.pickupCode')}</p>
                  <div className="flex items-center justify-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    <span className="text-3xl font-mono font-bold tracking-wider">{rental.pickup_code}</span>
                  </div>
                </div>
              )}

              {/* Renter: Pay Now button for approved rentals */}
              {!isOwner && rental.status === 'approved' && (
                <PayNowButton rental={rental} onPaymentCreated={onReviewSuccess} />
              )}

              {/* Owner: Start Handover for paid rentals */}
              {isOwner && rental.status === 'paid' && (
                <Button 
                  className="w-full h-12"
                  onClick={() => setHandoverDialog(true)}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {t('rental.startHandover')}
                </Button>
              )}

              {/* Owner: Process Return for active rentals */}
              {isOwner && rental.status === 'active' && (
                <Button 
                  className="w-full h-12"
                  onClick={() => setReturnDialog(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('rental.processReturn')}
                </Button>
              )}

              {/* Owner actions for pending_approval */}
              {isOwner && rental.status === 'pending_approval' && (
                <>
                  <Button 
                    className="w-full h-12"
                    onClick={() => { haptics.light(); setConfirmDialog({ open: true, action: 'approve' }); }}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {t('rental.approveRequest')}
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full h-12"
                    onClick={() => { haptics.light(); setConfirmDialog({ open: true, action: 'reject' }); }}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    {t('rental.declineRequest')}
                  </Button>
                </>
              )}
              
              {/* Status messages for renters */}
              {!isOwner && rental.status === 'pending_approval' && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t('rental.waitingApproval')}
                  </p>
                </div>
              )}

              {!isOwner && rental.status === 'rejected' && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    {t('rental.requestDeclined')}
                  </p>
                </div>
              )}

              {/* Disputed status */}
              {rental.status === 'disputed' && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-400 flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    {isOwner ? t('rental.disputeRaised') : t('rental.disputeRaisedByOwner')}
                  </p>
                  {rental.dispute_reason && (
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                      {t('rental.disputeReason')}: {rental.dispute_reason}
                    </p>
                  )}
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                    {t('rental.paymentFrozen')}
                  </p>
                </div>
              )}

              {/* View handover/return photos */}
              {rental.status === 'active' && rental.handover_photos && rental.handover_photos.length > 0 && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(rental.handover_photos[0], '_blank')}
                >
                  {t('rental.viewHandoverPhotos')} ({rental.handover_photos.length})
                </Button>
              )}

              {!isOwner && rental.status === 'active' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline"
                    className="h-12"
                    onClick={() => setModificationDialog({ open: true, type: 'extension' })}
                  >
                    <Clock3 className="h-4 w-4 mr-2" />
                    {t('rental.extend')}
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-12"
                    onClick={() => setModificationDialog({ open: true, type: 'early_return' })}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t('rental.returnEarly')}
                  </Button>
                </div>
              )}

              {canReview && (
                <Button 
                  variant="outline" 
                  className="w-full h-12"
                  onClick={() => setReviewDialogOpen(true)}
                >
                  {t('rental.leaveReview')}
                </Button>
              )}
            </div>
          </CardContent>
        </div>

        {/* Desktop: Horizontal Layout */}
        <div className="hidden md:block">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">{rental.item?.title}</CardTitle>
              <Badge className={`gap-1 ${getStatusColor(rental.status)}`}>
                {getStatusIcon(rental.status)}
                {rental.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>{t('rental.dates')}:</strong> {format(new Date(rental.start_date), 'MMM d, yyyy')} - {format(new Date(rental.end_date), 'MMM d, yyyy')}</p>
              <p><strong>{t('rental.total')}:</strong> RM {rental.total_price}</p>
              <p><strong>{isOwner ? t('rental.renter') : t('rental.owner')}:</strong> {isOwner ? rental.renter?.full_name : rental.owner?.full_name}</p>
            </div>
            
            {/* Renter: Pickup code for approved/paid rentals */}
            {!isOwner && (rental.status === 'approved' || rental.status === 'paid') && rental.pickup_code && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{t('rental.pickupCode')}</p>
                <div className="flex items-center justify-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <span className="text-3xl font-mono font-bold tracking-wider">{rental.pickup_code}</span>
                </div>
              </div>
            )}

            {/* Renter: Pay Now button for approved rentals */}
            {!isOwner && rental.status === 'approved' && (
              <PayNowButton rental={rental} onPaymentCreated={onReviewSuccess} />
            )}

            {/* Owner: Start Handover for paid rentals */}
            {isOwner && rental.status === 'paid' && (
              <Button 
                size="sm"
                onClick={() => setHandoverDialog(true)}
              >
                <Camera className="h-4 w-4 mr-2" />
                {t('rental.startHandover')}
              </Button>
            )}

            {/* Owner: Process Return for active rentals */}
            {isOwner && rental.status === 'active' && (
              <Button 
                size="sm"
                onClick={() => setReturnDialog(true)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('rental.processReturn')}
              </Button>
            )}

            {/* Owner actions for pending_approval */}
            {isOwner && rental.status === 'pending_approval' && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => { haptics.light(); setConfirmDialog({ open: true, action: 'approve' }); }}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {t('rental.approve')}
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => { haptics.light(); setConfirmDialog({ open: true, action: 'reject' }); }}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {t('rental.decline')}
                </Button>
              </div>
            )}
            
            {/* Status messages for renters */}
            {!isOwner && rental.status === 'pending_approval' && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('rental.waitingApproval')}
                </p>
              </div>
            )}

            {!isOwner && rental.status === 'rejected' && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-400 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {t('rental.requestDeclined')}
                </p>
              </div>
            )}

            {/* Disputed status */}
            {rental.status === 'disputed' && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-400 flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  {isOwner ? t('rental.disputeRaised') : t('rental.disputeRaisedByOwner')}
                </p>
                {rental.dispute_reason && (
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                    {t('rental.disputeReason')}: {rental.dispute_reason}
                  </p>
                )}
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                  {t('rental.paymentFrozen')}
                </p>
              </div>
            )}

            {/* View handover/return photos */}
            {rental.status === 'active' && rental.handover_photos && rental.handover_photos.length > 0 && (
              <Button 
                variant="outline"
                size="sm"
                onClick={() => window.open(rental.handover_photos[0], '_blank')}
              >
                View Handover Photos ({rental.handover_photos.length})
              </Button>
            )}

            {/* Renter modification options */}
            {!isOwner && rental.status === 'active' && (
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => setModificationDialog({ open: true, type: 'extension' })}
                >
                  <Clock3 className="h-4 w-4 mr-2" />
                  Extend
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => setModificationDialog({ open: true, type: 'early_return' })}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Return Early
                </Button>
              </div>
            )}

            {canReview && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setReviewDialogOpen(true)}
              >
                Leave a Review
              </Button>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogContent.title}</DialogTitle>
            <DialogDescription>{dialogContent.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, action: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmAction} 
              disabled={isUpdating}
            >
              {isUpdating ? 'Processing...' : dialogContent.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate your experience</DialogTitle>
          </DialogHeader>
          <ReviewForm 
            rentalId={rental.id} 
            revieweeId={revieweeId}
            onSuccess={() => {
              toast.success('Thank you for your review!');
              setReviewDialogOpen(false);
              onReviewSuccess();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Rental Modification Dialog */}
      {modificationDialog.type && (
        <RentalModificationDialog
          rental={rental}
          type={modificationDialog.type}
          open={modificationDialog.open}
          onOpenChange={(open) => setModificationDialog({ open, type: null })}
          onSuccess={onReviewSuccess}
        />
      )}

      {/* Handover Dialog */}
      <HandoverDialog
        rental={rental}
        open={handoverDialog}
        onOpenChange={setHandoverDialog}
        onSuccess={onReviewSuccess}
      />

      {/* Return/Dispute Dialog */}
      <ReturnDisputeDialog
        rental={rental}
        open={returnDialog}
        onOpenChange={setReturnDialog}
        onSuccess={onReviewSuccess}
      />
    </>
  );
}
