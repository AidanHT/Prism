import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AssignmentsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-36" />
      </div>

      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
