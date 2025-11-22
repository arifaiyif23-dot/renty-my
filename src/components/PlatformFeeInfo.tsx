import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export function PlatformFeeInfo() {
  return (
    <HoverCard>
      <HoverCardTrigger className="inline-flex items-center gap-1 text-primary cursor-help">
        <Info className="h-4 w-4" />
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-semibold">Platform Service Fee</h4>
          <p className="text-sm text-muted-foreground">
            The 10% service fee covers:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Secure escrow payment protection</li>
            <li>24/7 customer support</li>
            <li>Dispute resolution services</li>
            <li>Insurance claim processing</li>
            <li>Platform maintenance & security</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            💡 The owner receives 100% of the rental price they set
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
