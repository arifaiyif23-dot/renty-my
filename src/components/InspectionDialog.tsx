import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Wrench, AlertTriangle } from 'lucide-react';

interface InspectionDialogProps {
  itemId: string;
  itemTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InspectionDialog({ itemId, itemTitle, open, onOpenChange, onSuccess }: InspectionDialogProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<string>('available');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('submit-inspection', {
        body: {
          itemId,
          result,
          description: description || null,
        }
      });

      if (error) throw error;

      toast.success(t('inspection.success', { result: t(`common.${result}`) }));
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('inspection.failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('inspection.title')}</DialogTitle>
          <DialogDescription>
            {t('inspection.description', { title: itemTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={result} onValueChange={setResult} className="gap-3">
            <Label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:border-success has-[:checked]:bg-success/5">
              <RadioGroupItem value="available" className="mt-0.5" />
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle className="h-4 w-4 text-success" />
                  {t('inspection.passed')}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t('inspection.passedDesc')}</p>
              </div>
            </Label>

            <Label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:border-warning has-[:checked]:bg-warning/5">
              <RadioGroupItem value="maintenance" className="mt-0.5" />
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <Wrench className="h-4 w-4 text-warning" />
                  {t('inspection.maintenance')}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t('inspection.maintenanceDesc')}</p>
              </div>
            </Label>

            <Label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer has-[:checked]:border-destructive has-[:checked]:bg-destructive/5">
              <RadioGroupItem value="damaged" className="mt-0.5" />
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {t('inspection.damaged')}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t('inspection.damagedDesc')}</p>
              </div>
            </Label>
          </RadioGroup>

          {result !== 'available' && (
            <div className="space-y-2">
              <Label htmlFor="inspection-notes">{t('inspection.notes')}</Label>
              <Textarea
                id="inspection-notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('inspection.notesPlaceholder')}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={result === 'damaged' ? 'destructive' : result === 'maintenance' ? 'secondary' : 'default'}
            onClick={handleSubmit}
            disabled={isProcessing}
          >
            {isProcessing ? t('common.processing') : t('inspection.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
