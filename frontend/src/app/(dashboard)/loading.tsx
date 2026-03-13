import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard-level loading UI.
 *
 * Shown inside the AppShell chrome (sidebar stays visible) while the
 * requested page's JavaScript chunk is downloading, or while a Server
 * Component page is streaming its first byte.
 *
 * Matches the rough layout of the main dashboard page so the skeleton
 * doesn't cause a jarring layout shift on hydration.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Greeting skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-36" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Section label */}
          <Skeleton className="h-4 w-24" />

          {/* Course cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex flex-col gap-2 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="mt-1 h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>

          {/* Announcements label */}
          <Skeleton className="h-4 w-36" />

          {/* Announcement cards */}
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="flex gap-3 rounded-xl border p-4">
                <Skeleton className="mt-1 h-2 w-2 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          <div className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full shrink-0" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>

          <div className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-16" />
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-3 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
