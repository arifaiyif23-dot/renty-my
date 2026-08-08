import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Upload, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import type { ConditionGrade } from '@/types';
import { safeHttpUrl, sanitizeFileName } from '@/utils/sanitize';
import { optimizeImage } from '@/utils/imageOptimization';

const CONDITION_OPTIONS: { value: ConditionGrade; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'text-success' },
  { value: 'good', label: 'Good', color: 'text-action' },
  { value: 'fair', label: 'Fair', color: 'text-warning' },
  { value: 'poor', label: 'Poor', color: 'text-warning' },
  { value: 'damaged', label: 'Damaged', color: 'text-destructive' },
  { value: 'missing', label: 'Missing', color: 'text-muted-foreground' },
];

const CATEGORY_MAP: Record<string, string[]> = {
  electronics: ['Body', 'Screen', 'Keyboard', 'Ports', 'Cables', 'Accessories', 'Packaging'],
  vehicles: ['Body', 'Engine', 'Wheels', 'Lights', 'Brakes', 'Controls', 'Accessories'],
  tools: ['Body', 'Blade/Bit', 'Motor', 'Cord/Battery', 'Safety guards', 'Case'],
  sports: ['Frame/Body', 'Wheels', 'Grip/Straps', 'Moving parts', 'Accessories', 'Packaging'],
  party: ['Main item', 'Pieces/Parts', 'Packaging', 'Accessories'],
  fashion: ['Fabric', 'Stitching', 'Zippers/Buttons', 'Lining', 'Tags', 'Packaging'],
  other: ['Body', 'Parts', 'Accessories', 'Packaging'],
};

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  condition: ConditionGrade;
  notes: string;
  photoUrls: string[];
}

interface ConditionReportWizardProps {
  rentalId: string;
  reportType: 'pre_rental' | 'post_rental';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  itemCategory?: string;
}

const DEFAULT_PRE_FILL = 'Overall body condition';

export function ConditionReportWizard({ rentalId, reportType, open, onOpenChange, onSuccess, itemCategory }: ConditionReportWizardProps) {
  const categories = useMemo(() => {
    if (itemCategory && CATEGORY_MAP[itemCategory]) return CATEGORY_MAP[itemCategory];
    return CATEGORY_MAP.other;
  }, [itemCategory]);

  const [step, setStep] = useState(1);
  const [overallCondition, setOverallCondition] = useState<ConditionGrade | ''>('');
  const [overallNotes, setOverallNotes] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([
    { id: crypto.randomUUID(), category: categories[0], label: DEFAULT_PRE_FILL, condition: 'good', notes: '', photoUrls: [] },
  ]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const totalSteps = 3;

  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(), category: categories[0], label: '', condition: 'good', notes: '', photoUrls: [],
    }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ChecklistItem, value: unknown) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removePhoto = (itemId: string, photoIndex: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    updateItem(itemId, 'photoUrls', item.photoUrls.filter((_, i) => i !== photoIndex));
  };

  const handlePhotoUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const optimizedFile = new File([optimized], `${Date.now()}_${sanitizeFileName(file.name).replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });

      const fileName = `${rentalId}/condition/${itemId}_${Date.now()}_${optimizedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('rental-evidence')
        .upload(fileName, optimizedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('rental-evidence')
        .getPublicUrl(fileName);

      updateItem(itemId, 'photoUrls', [...(items.find(i => i.id === itemId)?.photoUrls || []), publicUrl]);
    } catch (error) {
      toast.error('Failed to upload photo');
      console.error(error);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!overallCondition) {
      toast.error('Please select overall condition');
      return;
    }
    if (items.length === 0 || items.some(i => !i.label.trim())) {
      toast.error('Please fill in all item labels');
      return;
    }
    if (!signatureName.trim()) {
      toast.error('Please enter your name as signature');
      return;
    }
    if (!confirmed) {
      toast.error('Please confirm the report is accurate');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('submit-condition-report', {
        body: {
          rental_id: rentalId,
          report_type: reportType,
          overall_condition: overallCondition,
          overall_notes: overallNotes || undefined,
          action: 'submit',
          items: items.map((item, i) => ({
            category: item.category,
            label: item.label,
            condition: item.condition,
            notes: item.notes || undefined,
            photo_urls: item.photoUrls.length > 0 ? item.photoUrls : undefined,
            display_order: i,
          })),
          signature_name: signatureName.trim(),
        },
      });

      if (error) throw error;

      toast.success(reportType === 'pre_rental' ? 'Pre-rental condition saved' : 'Return condition saved');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to submit condition report');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setOverallCondition('');
    setOverallNotes('');
    setItems([{ id: crypto.randomUUID(), category: categories[0], label: DEFAULT_PRE_FILL, condition: 'good', notes: '', photoUrls: [] }]);
    setSignatureName('');
    setConfirmed(false);
  };

  const handleOpenChangeWrapper = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const stepLabel = step === 1 ? 'Overall condition' : step === 2 ? 'Detailed checklist' : 'Sign & submit';

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reportType === 'pre_rental' ? 'Item Condition Report — Check-out' : 'Item Condition Report — Check-in'}
          </DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}: {stepLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i + 1 <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Overall Condition</Label>
              <Select value={overallCondition} onValueChange={(v) => setOverallCondition(v as ConditionGrade)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select overall condition" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                placeholder="Describe any existing damage, wear and tear, or notable details..."
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add checklist items for different parts of the item. Take photos of any existing damage.
            </p>

            {items.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select value={item.category} onValueChange={(v) => updateItem(item.id, 'category', v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Item / Part</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="e.g. Screen, Left handle..."
                      value={item.label}
                      onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-32 space-y-1">
                    <Label className="text-xs">Condition</Label>
                    <Select value={item.condition} onValueChange={(v) => updateItem(item.id, 'condition', v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 sm:mt-5 shrink-0" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <Input
                  placeholder="Notes (optional)"
                  value={item.notes}
                  onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                  className="h-9 text-sm"
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs cursor-pointer text-primary flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      <span>Add photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handlePhotoUpload(item.id, e)}
                      />
                    </Label>
                    {uploading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>

                  {item.photoUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.photoUrls.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                          <img src={url} alt="" className="object-cover w-full h-full" loading="lazy" />
                          <div className="absolute top-0 right-0 flex gap-1">
                            <a href={safeHttpUrl(url)} target="_blank" rel="noopener noreferrer" aria-label={`View photo ${idx + 1}`} className="w-11 h-11 bg-black/60 text-white flex items-center justify-center rounded-bl-lg">
                              <ZoomIn className="h-5 w-5" />
                            </a>
                          </div>
                          <button
                            type="button"
                            className="absolute -top-2 -right-2 w-11 h-11 rounded-full bg-destructive text-white flex items-center justify-center border border-background shadow-1"
                            onClick={() => removePhoto(item.id, idx)}
                            aria-label={`Remove photo ${idx + 1}`}
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium">Overall: <span className="capitalize">{overallCondition}</span></p>
              {overallNotes && <p className="text-sm text-muted-foreground mt-1">{overallNotes}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Checklist ({items.length} items):</p>
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <span className="text-muted-foreground w-5">{idx + 1}.</span>
                  <span className="font-medium w-24 truncate">{item.category}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className={`capitalize ${CONDITION_OPTIONS.find(o => o.value === item.condition)?.color}`}>
                    {item.condition}
                  </span>
                  {item.photoUrls.length > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">({item.photoUrls.length} photo{item.photoUrls.length > 1 ? 's' : ''})</span>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label>Your Name (as signature)</Label>
                <Input
                  placeholder="Type your full name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirm-accurate"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                <Label htmlFor="confirm-accurate" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  I confirm that this condition report is accurate to the best of my knowledge and I have inspected the item thoroughly.
                </Label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleOpenChangeWrapper(false)} className="w-full sm:w-auto">
            Cancel
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="flex-1 sm:flex-none">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={() => setStep(s => s + 1)} className="flex-1 sm:flex-none">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 sm:flex-none">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Report
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
