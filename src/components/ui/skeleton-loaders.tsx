import { Skeleton } from "@/components/ui/skeleton";

export const ConversationSkeleton = () => (
  <div className="flex items-center gap-3 p-3 rounded-2xl mb-1.5">
    <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
  </div>
);

export const ConversationListSkeleton = () => (
  <div className="space-y-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <ConversationSkeleton key={i} />
    ))}
  </div>
);

export const PostCardSkeleton = () => (
  <div className="rounded-lg border bg-card p-4 space-y-4">
    <div className="h-1 w-full rounded bg-muted" />
    <div className="flex items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <Skeleton className="h-48 w-full rounded-xl" />
    <div className="flex justify-between pt-2 border-t">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-10 rounded-full" />
      </div>
      <Skeleton className="h-9 w-28 rounded-full" />
    </div>
  </div>
);

export const FeedSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <PostCardSkeleton key={i} />
    ))}
  </div>
);
