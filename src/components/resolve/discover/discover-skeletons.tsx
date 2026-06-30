import { Skeleton } from "@/components/resolve/ui/skeleton";

export function DiscoverTrendingSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-busy="true" aria-label="Loading trending gaps">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25 p-4"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-14 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiscoverFeedSkeleton() {
  return (
    <ul
      className="divide-y divide-resolve-border/50 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25"
      aria-busy="true"
      aria-label="Loading live feed"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="space-y-2 px-4 py-3.5 sm:px-5">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-14 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DiscoverBubblemapSkeleton() {
  return (
    <div
      className="relative mx-auto aspect-[720/420] w-full max-w-full overflow-hidden rounded-lg bg-resolve-bg-deep/20"
      aria-busy="true"
      aria-label="Loading value bubblemap"
    >
      <Skeleton className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (2 * Math.PI * i) / 6;
        const x = 50 + Math.cos(angle) * 28;
        const y = 50 + Math.sin(angle) * 28;
        return (
          <div
            key={i}
            className="absolute"
            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
          >
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        );
      })}
    </div>
  );
}
