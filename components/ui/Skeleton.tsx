/** Base pulsing placeholder block — compose into row/card skeletons below. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />;
}

/** Mimics a ListRow: avatar circle + title/subtitle lines + a meta/badge placeholder. */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="hidden sm:block h-3 w-16 flex-shrink-0" />
      <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
    </div>
  );
}

/** Drop-in replacement for a centered <Loading/> spinner inside a list body. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}
