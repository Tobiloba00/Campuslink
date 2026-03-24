import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Detects when a new version of the app is available (via service worker)
 * and prompts the user to refresh.
 */
export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // If there's already a waiting worker, show prompt immediately
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
          return;
        }

        // Listen for new service worker installing
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // New SW is installed and waiting to activate
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setShowUpdate(true);
            }
          });
        });

        // Also check for updates periodically (every 30 min)
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);

      } catch (e) {
        // Silent fail — update prompt is non-critical
      }
    };

    // Listen for controller change (means new SW activated)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    checkForUpdates();
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Tell the waiting SW to skip waiting and become active
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdate(false);
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className={cn(
      "fixed top-20 left-4 right-4 z-[60] max-w-sm mx-auto",
      "bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl",
      "p-4 animate-in slide-in-from-top duration-500"
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Update available</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            A new version of CampusLink is ready. Refresh to get the latest features.
          </p>
          <button
            onClick={handleUpdate}
            className="mt-2.5 h-8 px-4 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all"
          >
            Refresh now
          </button>
        </div>
      </div>
    </div>
  );
}
