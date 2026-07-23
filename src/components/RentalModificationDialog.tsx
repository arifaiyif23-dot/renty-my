import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Rental } from '@/types';

interface RentalModificationDialogProps {
  rental: Rental;
  type: 'extension' | 'early_return';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RentalModificationDialog({ rental, type, open, onOpenChange, onSuccess }: RentalModificationDialogProps) {
  const [newEndDate, setNewEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const originalEndDate = new Date(rental.end_date);
  const originalStartDate = new Date(rental.start_date);
  const originalDays = differenceInDays(originalEndDate, originalStartDate);
  
  const calculatePriceAdjustment = () => {
    if (!newEndDate) return 0;
    
    if (type === 'extension') {
      const additionalDays = differenceInDays(newEndDate, originalEndDate);
      return additionalDays * Number(rental.item?.price_per_day || 0);
    } else {
      // Early return - calculate refund
      const returnedDays = differenceInDays(originalEndDate, newEndDate);
      return -1 * returnedDays * Number(rental.item?.price_per_day || 0);
    }
  };

  const handleSubmit = async () => {
    if (!newEndDate) {
      toast.error('Please select a date');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('rental_modifications')
        .insert({
          rental_id: rental.id,
          type,
          requested_by: rental.renter_id,
          original_end_date: rental.end_date,
          new_end_date: format(newEndDate, 'yyyy-MM-dd'),
          price_adjustment: calculatePriceAdjustment(),
          reason: reason.trim() || null,
        });

      if (error) throw error;

      toast.success(
        type === 'extension' 
          ? 'Extension request sent to owner' 
          : 'Early return request sent to owner'
      );
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      toast.error('Failed to submit request: ' + (error instanceof Error ? error.message : 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === 'extension' ? 'Request Extension' : 'Request Early Return'}
          </DialogTitle>
          <DialogDescription>
            {type === 'extension' 
              ? 'Request to extend your rental period. The owner must approve this request.'
              : 'Request to return the item early. A partial refund will be calculated.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current End Date</Label>
            <div className="text-sm text-muted-foreground">
              {format(originalEndDate, 'PPP')}
            </div>
          </div>

          <div className="space-y-2">
            <Label>New End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !newEndDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newEndDate ? format(newEndDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newEndDate}
                  onSelect={setNewEndDate}
                  disabled={(date) => {
                    if (type === 'extension') {
                      return date <= originalEndDate;
                    } else {
                      return date <= originalStartDate || date >= originalEndDate;
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {newEndDate && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span>Original rental period:</span>
                <span className="font-medium">{originalDays} days</span>
              </div>
              {type === 'extension' ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Additional days:</span>
                    <span className="font-medium">
                      {differenceInDays(newEndDate, originalEndDate)} days
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-primary">
                    <span>Additional cost:</span>
                    <span>RM {calculatePriceAdjustment().toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Days returned early:</span>
                    <span className="font-medium">
                      {differenceInDays(originalEndDate, newEndDate)} days
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-primary">
                    <span>Estimated refund:</span>
                    <span>RM {Math.abs(calculatePriceAdjustment()).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Textarea
              placeholder="Provide a reason for your request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !newEndDate}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}