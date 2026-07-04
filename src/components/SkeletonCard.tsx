import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonCard() {
  return (
    <Card className="overflow-hidden" role="status" aria-live="polite" aria-label="Loading item information">
      <Skeleton className="h-56 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="pt-3 border-t border-border">
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
    </Card>

  );
}
