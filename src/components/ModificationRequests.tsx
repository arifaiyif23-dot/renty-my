import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, DollarSign, CheckCircle, XCircle, Clock, ArrowRight, RotateCcw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
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

export interface ModificationRequestData {
  id: string;
  type: 'extension' | 'early_return';
  status: string;
  original_end_date: string;
  new_end_date: string;
  price_adjustment: number;
  reason: string | null;
  requested_at: string;
  rental: {
    id: string;
    item?: { title: string } | null;
    renter?: { full_name: string; avatar_url?: string | null } | null;
  };
}

interface ModificationRequestsProps {
  modifications: ModificationRequestData[];
  onUpdate: () => void;
}

export function ModificationRequests({ modifications, onUpdate }: ModificationRequestsProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    modificationId: string | null;
    action: 'approve' | 'reject';
    type?: string;
  }>({ open: false, modificationId: null, action: 'approve' });

  const handleResponse = async (modificationId: string, action: 'approve' | 'reject') => {
    setProcessingId(modificationId);
    try {
      const { error } = await supabase.functions.invoke('process-modification', {
        body: { modificationId, action },
      });

      if (error) throw error;

      toast.success(`Modification ${action === 'approve' ? 'approved' : 'declined'} successfully`);
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} modification`);
      console.error(error);
    } finally {
      setProcessingId(null);
      setConfirmDialog({ open: false, modificationId: null, action: 'approve' });
    }
  };

  if (modifications.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RotateCcw className="h-5 w-5" />
            Modification Requests
            <Badge variant="secondary">{modifications.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {modifications.map((mod) => {
            const isExtension = mod.type === 'extension';
            const daysDiff = differenceInDays(new Date(mod.new_end_date), new Date(mod.original_end_date));

            return (
              <div key={mod.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={mod.rental.renter?.avatar_url} />
                    <AvatarFallback>{mod.rental.renter?.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{mod.rental.renter?.full_name || 'Renter'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={isExtension ? 'default' : 'secondary'} className="text-xs">
                        {isExtension ? 'Extension' : 'Early Return'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(mod.requested_at), 'MMM dd')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Item</p>
                    <p className="font-medium truncate">{mod.rental.item?.title || 'Item'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Adjustment</p>
                    <p className={`font-semibold ${isExtension ? 'text-primary' : 'text-success'}`}>
                      {isExtension ? '+' : '-'} RM {Math.abs(mod.price_adjustment).toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Dates
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm line-through text-muted-foreground">
                        {format(new Date(mod.original_end_date), 'MMM dd')}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(mod.new_end_date), 'MMM dd, yyyy')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({isExtension ? '+' : '-'}{Math.abs(daysDiff)} days)
                      </span>
                    </div>
                  </div>
                </div>

                {mod.reason && (
                  <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                    "{mod.reason}"
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmDialog({ open: true, modificationId: mod.id, action: 'approve', type: mod.type })}
                    disabled={processingId === mod.id}
                  >
                    {processingId === mod.id ? (
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmDialog({ open: true, modificationId: mod.id, action: 'reject', type: mod.type })}
                    disabled={processingId === mod.id}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, modificationId: null, action: 'approve' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' ? 'Approve Modification?' : 'Decline Modification?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve' ? (
                confirmDialog.type === 'extension'
                  ? 'The rental end date will be extended and the additional cost will be charged to the renter.'
                  : 'The rental will end early and a partial refund will be issued to the renter.'
              ) : (
                'The modification request will be declined. The renter will be notified.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.modificationId && handleResponse(confirmDialog.modificationId, confirmDialog.action)}
            >
              {confirmDialog.action === 'approve' ? 'Approve' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
