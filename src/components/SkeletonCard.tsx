import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonCard() {
  return (
    <Card className="overflow-hidden rounded-xl border-border/50" role="status" aria-live="polite" aria-label="Loading item information">
      {/* Image Skeleton */}
      <Skeleton className="aspect-[16/9] w-full" />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-16" />
        </div>
        
        <Skeleton className="h-4 w-3/4" />
        
        <div className="pt-2 border-t border-border/50">
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
    </Card>
  );
}
