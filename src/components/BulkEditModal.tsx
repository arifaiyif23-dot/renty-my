import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  action: 'activate' | 'pause' | 'delete' | 'category' | 'export';
}

export function BulkEditModal({ open, onOpenChange, selectedIds, action }: BulkEditModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      switch (action) {
        case 'activate':
          const { error: activateError } = await supabase
            .from('items')
            .update({ listing_status: 'active' })
            .in('id', selectedIds);
          if (activateError) throw activateError;
          break;

        case 'pause':
          const { error: pauseError } = await supabase
            .from('items')
            .update({ listing_status: 'paused' })
            .in('id', selectedIds);
          if (pauseError) throw pauseError;
          break;

        case 'delete':
          const { error: deleteError } = await supabase
            .from('items')
            .delete()
            .in('id', selectedIds);
          if (deleteError) throw deleteError;
          break;

        case 'category':
          if (!category) throw new Error('Please select a category');
          const { error: categoryError} = await supabase
            .from('items')
            .update({ category: category as 'electronics' | 'tools' | 'sports' | 'party' | 'vehicles' | 'fashion' | 'other' })
            .in('id', selectedIds);
          if (categoryError) throw categoryError;
          break;

        case 'export':
          const { data: items, error: exportError } = await supabase
            .from('items')
            .select('*')
            .in('id', selectedIds);
          if (exportError) throw exportError;
          
          // Create CSV
          const csv = [
            ['ID', 'Title', 'Category', 'Price', 'Status', 'Views', 'Bookings'].join(','),
            ...items.map((item) =>
              [
                item.id,
                `"${item.title}"`,
                item.category,
                item.price_per_day,
                item.listing_status,
                item.view_count,
                item.booking_count,
              ].join(',')
            ),
          ].join('\n');

          // Download
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `listings-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
          break;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      const messages = {
        activate: 'Listings activated successfully',
        pause: 'Listings paused successfully',
        delete: t('listings.deleteSuccess'),
        category: 'Category updated successfully',
        export: 'Data exported successfully',
      };
      toast.success(messages[action]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Operation failed');
    },
  });

  const getTitle = () => {
    const titles = {
      activate: t('listings.activateAll'),
      pause: t('listings.pauseAll'),
      delete: t('listings.deleteSelected'),
      category: 'Change Category',
      export: t('listings.exportData'),
    };
    return titles[action];
  };

  const getDescription = () => {
    const count = selectedIds.length;
    if (action === 'delete') {
      return t('listings.confirmBulkDelete', { count });
    }
    return `You are about to ${action} ${count} listing(s)`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {action === 'delete' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. This will permanently delete the selected listings.
            </AlertDescription>
          </Alert>
        )}

        {action === 'category' && (
          <div className="space-y-2">
            <Label htmlFor="category">Select New Category</Label>
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="party">Party</SelectItem>
                <SelectItem value="fashion">Fashion</SelectItem>
                <SelectItem value="vehicles">Vehicles</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={action === 'delete' ? 'destructive' : 'default'}
            onClick={() => bulkUpdateMutation.mutate()}
            disabled={bulkUpdateMutation.isPending || (action === 'category' && !category)}
          >
            {bulkUpdateMutation.isPending ? t('common.loading') : t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
