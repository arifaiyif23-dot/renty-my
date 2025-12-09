import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Profile Card Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="min-h-[140px]">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-12 w-12 md:h-16 md:w-16 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referral Section Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
