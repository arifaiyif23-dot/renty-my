import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

interface ListingsSkeletonProps {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
}

export default function ListingsSkeleton({ 
  count = 6, 
  columns = 3 
}: ListingsSkeletonProps) {
  const gridClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-6`}>
      {[...Array(count)].map((_, i) => (
        <Card 
          key={i} 
          className="overflow-hidden rounded-xl border-border/50"
          role="status"
          aria-label="Loading item"
        >
          {/* Image Skeleton with aspect ratio */}
          <Skeleton className="aspect-[16/9] w-full" />
          
          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Title and badge */}
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            
            {/* Description/location */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            
            {/* Price section */}
            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
