export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="skeleton-card" />
      <div className="mt-3 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[70vh] md:h-[80vh] w-full animate-pulse bg-dark-300">
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl space-y-4">
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-12 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-20 w-full" />
            <div className="flex gap-4">
              <div className="skeleton h-12 w-40 rounded-lg" />
              <div className="skeleton h-12 w-32 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EpisodeSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="skeleton h-12 w-full rounded-lg" />
    </div>
  );
}

export function EpisodeListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <EpisodeSkeleton key={i} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="skeleton w-full md:w-64 aspect-poster rounded-xl" />
        <div className="flex-1 space-y-4">
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-6 w-16 rounded-full" />
            ))}
          </div>
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="animate-pulse flex gap-4">
      <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    </div>
  );
}

export function CommentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </div>
  );
}
