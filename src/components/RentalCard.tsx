import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReviewForm } from "@/components/ReviewForm";
import { RentalModificationDialog } from "@/components/RentalModificationDialog";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, Calendar, DollarSign, Clock3, RotateCcw } from "lucide-react";
import { Rental } from "@/types";
import { toast } from "sonner";

interface RentalCardProps {
  rental: Rental;
  isOwner: boolean;
  onStatusUpdate: (rentalId: string, status: Rental['status']) => Promise<void>;
  onReviewSuccess: () => void;
}

export function RentalCard({ rental, isOwner, onStatusUpdate, onReviewSuccess }: RentalCardProps) {
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

  const canReview = rental.status === 'completed';
  const revieweeId = isOwner ? rental.renter_id : rental.owner_id;

  const getStatusColor = (status: Rental['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-500/30';
      case 'approved':
      case 'active':
        return 'bg-green-500/20 text-green-800 dark:text-green-400 border-green-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-500/30';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-500/20 text-red-800 dark:text-red-400 border-red-500/30';
      default:
        return '';
    }
  };

  const getStatusIcon = (status: Rental['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'approved':
      case 'active':
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
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

    setIsUpdating(true);
    try {
      await onStatusUpdate(rental.id, statusMap[confirmDialog.action]);
    } finally {
      setIsUpdating(false);
      setConfirmDialog({ open: false, action: null });
    }
  };

  const getConfirmDialogContent = () => {
    switch (confirmDialog.action) {
      case 'approve':
        return {
          title: 'Approve Rental Request',
          description: `Are you sure you want to approve this rental for ${rental.item?.title}?`,
          confirmText: 'Approve',
        };
      case 'reject':
        return {
          title: 'Reject Rental Request',
          description: `Are you sure you want to reject this rental request for ${rental.item?.title}?`,
          confirmText: 'Reject',
        };
      case 'active':
        return {
          title: 'Activate Rental',
          description: `Mark this rental as active? The renter has picked up ${rental.item?.title}.`,
          confirmText: 'Mark Active',
        };
      case 'complete':
        const alreadyConfirmed = isOwner ? rental.owner_confirmed_completion : rental.renter_confirmed_completion;
        const otherConfirmed = isOwner ? rental.renter_confirmed_completion : rental.owner_confirmed_completion;
        return {
          title: 'Complete Rental',
          description: alreadyConfirmed 
            ? 'You have already confirmed completion. Waiting for the other party.'
            : otherConfirmed 
              ? 'The other party has confirmed. Once you confirm, payment will be processed.'
              : 'Confirm rental completion? Both parties must confirm before payment is processed.',
          confirmText: alreadyConfirmed ? 'Already Confirmed' : 'Confirm Completion',
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
                  Dates
                </p>
                <p className="font-medium text-xs leading-tight">
                  {format(new Date(rental.start_date), 'MMM d')} - {format(new Date(rental.end_date), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Total
                </p>
                <p className="font-semibold text-lg">RM {rental.total_price}</p>
              </div>
            </div>

            <div className="text-sm pt-2 border-t">
              <p className="text-muted-foreground">{isOwner ? 'Renter' : 'Owner'}</p>
              <p className="font-medium">{isOwner ? rental.renter?.full_name : rental.owner?.full_name}</p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              {isOwner && rental.status === 'pending' && (
                <>
                  <Button 
                    className="w-full h-12"
                    onClick={() => setConfirmDialog({ open: true, action: 'approve' })}
                    disabled={isUpdating}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full h-12"
                    onClick={() => setConfirmDialog({ open: true, action: 'reject' })}
                    disabled={isUpdating}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                </>
              )}
              
              {isOwner && rental.status === 'approved' && (
                <Button 
                  className="w-full h-12"
                  onClick={() => setConfirmDialog({ open: true, action: 'active' })}
                  disabled={isUpdating}
                >
                  Mark as Active
                </Button>
              )}
              
              {rental.status === 'active' && (
                <Button 
                  className="w-full h-12"
                  onClick={() => setConfirmDialog({ open: true, action: 'complete' })}
                  disabled={isUpdating || (isOwner ? rental.owner_confirmed_completion : rental.renter_confirmed_completion)}
                >
                  {isOwner 
                    ? (rental.owner_confirmed_completion ? '✓ Waiting for Renter' : 'Complete Rental')
                    : (rental.renter_confirmed_completion ? '✓ Waiting for Owner' : 'Complete Rental')
                  }
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
                    Extend
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-12"
                    onClick={() => setModificationDialog({ open: true, type: 'early_return' })}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Return Early
                  </Button>
                </div>
              )}

              {canReview && (
                <Button 
                  variant="outline" 
                  className="w-full h-12"
                  onClick={() => setReviewDialogOpen(true)}
                >
                  Leave a Review
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
              <p><strong>Dates:</strong> {format(new Date(rental.start_date), 'MMM d, yyyy')} - {format(new Date(rental.end_date), 'MMM d, yyyy')}</p>
              <p><strong>Total:</strong> RM {rental.total_price}</p>
              <p><strong>{isOwner ? 'Renter' : 'Owner'}:</strong> {isOwner ? rental.renter?.full_name : rental.owner?.full_name}</p>
            </div>
            
            {isOwner && rental.status === 'pending' && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => setConfirmDialog({ open: true, action: 'approve' })}
                  disabled={isUpdating}
                >
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => setConfirmDialog({ open: true, action: 'reject' })}
                  disabled={isUpdating}
                >
                  Reject
                </Button>
              </div>
            )}
            
            {isOwner && rental.status === 'approved' && (
              <Button 
                size="sm" 
                onClick={() => setConfirmDialog({ open: true, action: 'active' })}
                disabled={isUpdating}
              >
                Mark as Active
              </Button>
            )}
            
            {rental.status === 'active' && (
              <Button 
                size="sm" 
                onClick={() => setConfirmDialog({ open: true, action: 'complete' })}
                disabled={isUpdating || (isOwner ? rental.owner_confirmed_completion : rental.renter_confirmed_completion)}
              >
                {isOwner 
                  ? (rental.owner_confirmed_completion ? '✓ Waiting for Renter' : 'Complete Rental')
                  : (rental.renter_confirmed_completion ? '✓ Waiting for Owner' : 'Complete Rental')
                }
              </Button>
            )}

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
              disabled={isUpdating || (confirmDialog.action === 'complete' && (isOwner ? rental.owner_confirmed_completion : rental.renter_confirmed_completion))}
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
    </>
  );
}
