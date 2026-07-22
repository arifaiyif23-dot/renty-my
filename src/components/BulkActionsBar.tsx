import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, CheckCheck, XCircle } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkComplete: () => void;
  onBulkCancel: () => void;
  showComplete?: boolean;
  showCancel?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkComplete,
  onBulkCancel,
  showComplete = true,
  showCancel = true,
}: BulkActionsBarProps) {
  return (
    <>
      {selectedCount > 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 mx-auto max-w-2xl z-50 animate-slide-in-right">
          <div className="bg-card border shadow-lg rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {selectedCount} selected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>

              <div className="flex gap-2">
                {showComplete && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onBulkComplete}
                    className="h-9"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                )}
                {showCancel && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onBulkCancel}
                    className="h-9"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
