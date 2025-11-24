import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { Rental } from '@/types';

interface ReturnDisputeDialogProps {
  rental: Rental;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReturnDisputeDialog({ rental, open, onOpenChange, onSuccess }: ReturnDisputeDialogProps) {
  const [path, setPath] = useState<'good' | 'dispute' | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [disputeReason, setDisputeReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setPhotos(prev => [...prev, ...files]);

    // Upload to storage
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const fileName = `${rental.id}/return_${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('rental-evidence')
        .upload(fileName, file);

      if (error) {
        toast.error('Failed to upload photo');
        console.error(error);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('rental-evidence')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    setPhotoUrls(prev => [...prev, ...uploadedUrls]);
    toast.success(`${files.length} photo(s) uploaded`);
  };

  const handleCompleteGoodCondition = async () => {
    if (photoUrls.length === 0) {
      toast.error('Please upload at least 1 return photo');
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('rentals')
        .update({
          status: 'completed',
          return_photos: photoUrls,
        })
        .eq('id', rental.id);

      if (error) throw error;

      toast.success('Rental completed successfully! Payout will be processed.');
      onSuccess();
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete rental');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRaiseDispute = async () => {
    if (photoUrls.length === 0) {
      toast.error('Please upload evidence photos');
      return;
    }

    if (!disputeReason.trim()) {
      toast.error('Please describe the issue');
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('rentals')
        .update({
          status: 'disputed',
          return_photos: photoUrls,
          dispute_reason: disputeReason,
          dispute_status: 'open',
          is_disputed: true,
        })
        .eq('id', rental.id);

      if (error) throw error;

      // Notify renter about dispute
      await supabase.from('notifications').insert({
        user_id: rental.renter_id,
        type: 'rental_request',
        title: 'Dispute Raised',
        message: `The owner has raised a dispute for "${rental.item?.title}". Reason: ${disputeReason}`,
        link: '/dashboard'
      });

      toast.warning('Dispute raised. Payment is frozen pending admin review.');
      onSuccess();
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error(error.message || 'Failed to raise dispute');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setPath(null);
    setPhotos([]);
    setPhotoUrls([]);
    setDisputeReason('');
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetState();
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Return</DialogTitle>
          <DialogDescription>
            Review the returned item and complete the rental
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Path Selection */}
          {!path && (
            <RadioGroup value={path || ''} onValueChange={(v) => setPath(v as 'good' | 'dispute')}>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="good" id="good" />
                  <Label htmlFor="good" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">Item in Good Condition</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Complete the rental and release payment
                    </p>
                  </Label>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="dispute" id="dispute" />
                  <Label htmlFor="dispute" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold">Report an Issue</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Item is damaged, late, or missing
                    </p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          )}

          {/* Photo Upload (Common for both paths) */}
          {path && (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  id="return-photos"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <label htmlFor="return-photos" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {path === 'good' ? 'Upload Return Photos' : 'Upload Evidence Photos'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    At least 1 photo required
                  </p>
                </label>
              </div>

              {photoUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photoUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                      <img src={url} alt={`Return ${idx + 1}`} className="object-cover w-full h-full" />
                      <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Dispute Reason (Only for dispute path) */}
          {path === 'dispute' && (
            <div className="space-y-2">
              <Label htmlFor="dispute-reason">Describe the Issue</Label>
              <Textarea
                id="dispute-reason"
                placeholder="e.g., Item returned with scratches on the screen, returned 2 days late without notice, item is missing accessories..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={4}
              />
              
              <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg mt-4">
                <Shield className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-400">
                    Payment Freeze Notice
                  </p>
                  <p className="text-orange-700 dark:text-orange-300 text-xs mt-1">
                    The payment will be frozen until an admin reviews this dispute
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Good Condition Confirmation */}
          {path === 'good' && photoUrls.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-800 dark:text-green-400">
                  Ready to Complete
                </p>
                <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                  Confirm the item is returned in good condition. Your payout will be released.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (path) {
                setPath(null);
              } else {
                onOpenChange(false);
              }
            }}
            className="w-full sm:w-auto"
          >
            {path ? 'Back' : 'Cancel'}
          </Button>
          
          {path === 'good' && (
            <Button
              onClick={handleCompleteGoodCondition}
              disabled={photoUrls.length === 0 || isProcessing}
              className="w-full sm:w-auto"
            >
              {isProcessing ? 'Processing...' : 'Confirm & Complete'}
            </Button>
          )}

          {path === 'dispute' && (
            <Button
              variant="destructive"
              onClick={handleRaiseDispute}
              disabled={photoUrls.length === 0 || !disputeReason.trim() || isProcessing}
              className="w-full sm:w-auto"
            >
              {isProcessing ? 'Raising...' : 'Raise Dispute'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}