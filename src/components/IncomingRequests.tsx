import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Calendar, DollarSign, CheckCircle, XCircle, ShieldCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { formatDuration, formatRentalPeriod, rentalHours } from '@/lib/rentalTime';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface IncomingRequestsProps {
  rentals: Rental[];
  onUpdate: () => void;
}

export function IncomingRequests({ rentals, onUpdate }: IncomingRequestsProps) {
  const { t } = useTranslation();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ 
    open: boolean; 
    rentalId: string | null; 
    action: 'approve' | 'reject';
    rental?: Rental;
  }>({ open: false, rentalId: null, action: 'approve' });

  const handleApproval = async (rentalId: string, action: 'approve' | 'reject') => {
    setProcessingId(rentalId);
    try {
      const { error } = await supabase.functions.invoke('process-rental-approval', {
        body: { rentalId, action }
      });

      if (error) throw error;

      toast.success(t(`incomingRequests.${action === 'approve' ? 'confirmed' : 'declined'}`), {
        description: t(action === 'approve' ? 'incomingRequests.confirmNotifyDesc' : 'incomingRequests.declineNotifyDesc')
      });
      
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t(`incomingRequests.${action === 'approve' ? 'failedToApprove' : 'failedToDecline'}`));
      console.error(error);
    } finally {
      setProcessingId(null);
      setConfirmDialog({ open: false, rentalId: null, action: 'approve' });
    }
  };

  const PENDING_STATUSES = ['requested', 'payment_pending', 'reserved'];
  const pendingRequests = rentals.filter(r => PENDING_STATUSES.includes(r.status));

  if (pendingRequests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('incomingRequests.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            {t('incomingRequests.noPending')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('incomingRequests.title')}
            <Badge variant="secondary">{pendingRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingRequests.map((rental) => {
            return (
              <div key={rental.id} className="border rounded-lg p-4 space-y-4">
                {/* Renter Info with Verification Status */}
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={rental.renter?.avatar_url} />
                    <AvatarFallback>{rental.renter?.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{rental.renter?.full_name}</p>
                      {rental.renter?.is_verified && (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="h-3 w-3 text-success" />
                          {t('incomingRequests.idVerified')}
                        </Badge>
                      )}
                    </div>
                    {!rental.renter?.is_verified && (
                      <Badge variant="destructive" className="mt-1">
                        {t('incomingRequests.notVerified')}
                      </Badge>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {rental.renter?.location || t('incomingRequests.noLocation')}
                    </p>
                  </div>
                </div>

                {/* Item & Booking Details */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('incomingRequests.item')}</p>
                    <p className="font-medium">{rental.item?.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('incomingRequests.duration')}</p>
                    <p className="font-medium">{formatDuration(rentalHours(rental.start_date, rental.end_date, rental.pickup_time, rental.return_time))}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('incomingRequests.dates')}
                    </p>
                    <p className="font-medium text-sm">
                      {formatRentalPeriod(rental.start_date, rental.end_date, rental.pickup_time, rental.return_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {t('incomingRequests.amount')}
                    </p>
                    <p className="font-semibold text-lg">RM {rental.total_price}</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-2 border-t">
                  {t('incomingRequests.requested')} {format(new Date(rental.created_at), 'MMM dd, yyyy')}
                </p>

                {/* Action Buttons */}
                {rental.status === 'reserved' ? (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => setConfirmDialog({ 
                        open: true, 
                        rentalId: rental.id, 
                        action: 'approve',
                        rental 
                      })}
                      disabled={processingId === rental.id}
                    >
                      {processingId === rental.id && confirmDialog.action === 'approve' ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          {t('incomingRequests.approving')}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {t('incomingRequests.approve')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmDialog({ 
                        open: true, 
                        rentalId: rental.id, 
                        action: 'reject',
                        rental 
                      })}
                      disabled={processingId === rental.id}
                    >
                      {processingId === rental.id && confirmDialog.action === 'reject' ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          {t('incomingRequests.declining')}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          {t('incomingRequests.decline')}
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                    <p className="text-sm text-warning flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {t('incomingRequests.waitingRenterPayment')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, rentalId: null, action: 'approve' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' ? t('incomingRequests.approveTitle') : t('incomingRequests.declineTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve' ? (
                <>
                  {t('incomingRequests.approveDesc')}
                  <br /><br />
                  <strong>{t('incomingRequests.itemLabel')}</strong> {confirmDialog.rental?.item?.title}<br />
                  <strong>{t('incomingRequests.amountLabel')}</strong> RM {confirmDialog.rental?.total_price}
                </>
              ) : (
                <>
                  {t('incomingRequests.declineDesc')}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.rentalId && handleApproval(confirmDialog.rentalId, confirmDialog.action)}
            >
              {confirmDialog.action === 'approve' ? t('incomingRequests.approve') : t('incomingRequests.decline')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}