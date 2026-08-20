import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Camera } from 'lucide-react';
import type { ConditionReport } from '@/types';
import { safeHttpUrl } from '@/utils/sanitize';
import { useSignedUrls } from '@/hooks/useSignedUrls';

interface ReturnConditionComparisonProps {
  rentalId: string;
}

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-success/10 text-success border-success/30',
  good: 'bg-action/10 text-action border-action/30',
  fair: 'bg-warning/10 text-warning border-warning/30',
  poor: 'bg-warning/10 text-warning border-warning/30',
  damaged: 'bg-destructive/10 text-destructive border-destructive/30',
  missing: 'bg-muted text-muted-foreground border-border',
};

export function ReturnConditionComparison({ rentalId }: ReturnConditionComparisonProps) {
  const [preRentalReport, setPreRentalReport] = useState<ConditionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const allPhotoUrls = useSignedUrls(preRentalReport?.items?.flatMap(i => i.photo_urls || []) ?? null);

  useEffect(() => {
    let cancelled = false;
    const fetchReport = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase.functions.invoke('get-condition-report?rental_id=' + rentalId);
        if (cancelled) return;
        const reports = (data || []) as ConditionReport[];
        const pre = reports.find((r: ConditionReport) => r.report_type === 'pre_rental');
        setPreRentalReport(pre || null);
      } catch (err) {
        console.error('Failed to load pre-rental condition report:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchReport();
    return () => { cancelled = true; };
  }, [rentalId]);

  if (loading || !preRentalReport) return null;

  const allPhotos = allPhotoUrls;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          Pre-rental Condition
          <Badge variant="outline" className={CONDITION_COLORS[preRentalReport.overall_condition || ''] || ''}>
            {preRentalReport.overall_condition}
          </Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-3">
        {preRentalReport.overall_notes && (
          <p className="text-sm text-muted-foreground">{preRentalReport.overall_notes}</p>
        )}

        {preRentalReport.items && preRentalReport.items.length > 0 && (
          <div className="space-y-1">
            {preRentalReport.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                <span className="text-muted-foreground w-20 text-xs truncate">{item.category}</span>
                <span className="flex-1 truncate">{item.label}</span>
                <Badge variant="outline" className={`${CONDITION_COLORS[item.condition] || ''} text-xs`}>
                  {item.condition}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {allPhotos.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Pre-rental photos ({allPhotos.length})</p>
            <div className="grid grid-cols-4 gap-2">
              {allPhotos.map((url, idx) => (
                <a key={idx} href={safeHttpUrl(url)} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border hover:opacity-80">
                  <img src={url} alt={`Pre-rental ${idx + 1}`} className="object-cover w-full h-full" loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
