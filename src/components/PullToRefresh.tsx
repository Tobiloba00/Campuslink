import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  isReady: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
  isReady,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-14 left-0 right-0 z-40 flex justify-center pointer-events-none transition-transform duration-200"
      style={{
        transform: `translateY(${isRefreshing ? 40 : Math.min(pullDistance, 80)}px)`,
        opacity: isRefreshing ? 1 : Math.min(1, progress * 1.5),
      }}
    >
      <div className={cn(
        "h-10 w-10 rounded-full bg-background border border-border/50 shadow-lg flex items-center justify-center transition-all duration-200",
        isReady && "bg-primary/10 border-primary/30",
        isRefreshing && "bg-primary/10 border-primary/30"
      )}>
        <RefreshCw
          className={cn(
            "h-4 w-4 text-muted-foreground transition-all duration-200",
            isReady && "text-primary",
            isRefreshing && "text-primary animate-spin"
          )}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
          }}
        />
      </div>
    </div>
  );
}
