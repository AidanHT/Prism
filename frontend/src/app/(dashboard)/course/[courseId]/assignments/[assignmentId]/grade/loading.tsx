import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SpeedGraderLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-10" />
      </div>

      {/* SpeedGrader panel skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Submission preview */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-64 w-full rounded-md" />
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>

        {/* Rubric / scoring panel */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-44 mt-1" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-8 w-12 rounded-md" />
                  ))}
                </div>
              </div>
            ))}
            <Skeleton className="h-24 w-full rounded-md mt-2" />
            <Skeleton className="h-9 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
