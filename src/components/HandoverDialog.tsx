import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Camera, CheckCircle } from 'lucide-react';
import { Rental } from '@/types';

interface HandoverDialogProps {
  rental: Rental;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function HandoverDialog({ rental, open, onOpenChange, onSuccess }: HandoverDialogProps) {
  const [step, setStep] = useState<'upload' | 'verify'>('upload');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [enteredCode, setEnteredCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const resetState = () => {
    setStep('upload');
    setPhotos([]);
    setPhotoUrls([]);
    setEnteredCode('');
    setIsProcessing(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setPhotos(prev => [...prev, ...files]);

    // Upload to storage
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const fileName = `${rental.id}/${Date.now()}_${file.name}`;
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

  const handleVerifyCode = async () => {
    if (enteredCode !== rental.pickup_code) {
      toast.error('Invalid pickup code');
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('rentals')
        .update({
          status: 'active',
          actual_start_at: new Date().toISOString(),
          handover_photos: photoUrls,
        })
        .eq('id', rental.id);

      if (error) throw error;

      toast.success('Rental Started Successfully! 🎉');
      onSuccess();
      handleOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start rental');
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceedToVerify = photoUrls.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start Handover Process</DialogTitle>
          <DialogDescription>
            {step === 'upload' 
              ? 'Upload photos of the item condition before handover'
              : 'Enter the 4-digit code from the renter'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                id="handover-photos"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <label htmlFor="handover-photos" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Upload Evidence Photos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  At least 1 photo required
                </p>
              </label>
            </div>

            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt={`Evidence ${idx + 1}`} className="object-cover w-full h-full" />
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Camera className="h-5 w-5 text-blue-600" />
              <p className="text-sm text-blue-800 dark:text-blue-400">
                Photos uploaded: {photoUrls.length}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label htmlFor="pickup-code">Enter Renter's Pickup Code</Label>
              <Input
                id="pickup-code"
                type="text"
                maxLength={4}
                placeholder="4-digit code"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl font-mono mt-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The renter should show you their 4-digit pickup code
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          {step === 'upload' ? (
            <Button
              onClick={() => setStep('verify')}
              disabled={!canProceedToVerify}
              className="w-full sm:w-auto"
            >
              Next: Verify Code
            </Button>
          ) : (
            <Button
              onClick={handleVerifyCode}
              disabled={enteredCode.length !== 4 || isProcessing}
              className="w-full sm:w-auto"
            >
              {isProcessing ? 'Starting...' : 'Start Rental'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}