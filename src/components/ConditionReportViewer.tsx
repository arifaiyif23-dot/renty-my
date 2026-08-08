import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ConditionReport } from '@/types';

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-success/10 text-success border-success/30',
  good: 'bg-action/10 text-action border-action/30',
  fair: 'bg-warning/10 text-warning border-warning/30',
  poor: 'bg-warning/10 text-warning border-warning/30',
  damaged: 'bg-destructive/10 text-destructive border-destructive/30',
  missing: 'bg-muted text-muted-foreground border-border',
};

interface ConditionReportViewerProps {
  reports: ConditionReport[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConditionReportViewer({ reports, open, onOpenChange }: ConditionReportViewerProps) {
  if (reports.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Condition Reports</DialogTitle>
          <DialogDescription>
            {reports.length} report{reports.length > 1 ? 's' : ''} — {reports.filter(r => r.status === 'submitted').length} submitted
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline">
                      {report.report_type === 'pre_rental' ? 'Check-out' : 'Check-in'}
                    </Badge>
                    <Badge className="ml-2" variant={report.status === 'submitted' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Overall:</span>
                  <Badge className={CONDITION_COLORS[report.overall_condition || ''] || ''} variant="outline">
                    {report.overall_condition}
                  </Badge>
                </div>

                {report.overall_notes && (
                  <p className="text-sm text-muted-foreground">{report.overall_notes}</p>
                )}

                {/* Items */}
                <div className="space-y-1">
                  {report.items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                      <span className="text-muted-foreground w-20 text-xs">{item.category}</span>
                      <span className="flex-1">{item.label}</span>
                      <Badge className={`${CONDITION_COLORS[item.condition] || ''} text-xs`} variant="outline">
                        {item.condition}
                      </Badge>
                      {item.notes && (
                        <span className="text-xs text-muted-foreground max-w-[120px] truncate" title={item.notes}>
                          {item.notes}
                        </span>
                      )}
                      {item.photo_urls && item.photo_urls.length > 0 && (
                        <span className="text-xs text-muted-foreground">{item.photo_urls.length} 📷</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Signatures */}
                {report.signatures && report.signatures.length > 0 && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {report.signatures.map(sig => (
                      <p key={sig.id}>
                        {sig.role === 'owner' ? 'Owner' : 'Renter'} signed on {new Date(sig.signed_at).toLocaleString()}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
