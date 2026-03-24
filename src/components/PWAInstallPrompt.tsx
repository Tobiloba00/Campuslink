import { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    // Already installed
    if (isInStandaloneMode()) return;

    // Respect 7-day dismissal
    const dismissedAt = localStorage.getItem('pwa-dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 86400000) return;

    // iOS Safari — show custom instructions
    if (isIOS()) {
      setIsApple(true);
      // Show after 20 seconds on iOS
      const timer = setTimeout(() => setShowBanner(true), 20000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome — use native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    localStorage.setItem('pwa-dismissed', Date.now().toString());
  };

  if (!showBanner || dismissed) return null;
  // On Android, only show if we have the native prompt
  if (!isApple && !deferredPrompt) return null;

  return (
    <div className={cn(
      "fixed bottom-20 lg:bottom-6 left-4 right-4 z-50 max-w-sm mx-auto",
      "bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl",
      "p-4 animate-in slide-in-from-bottom duration-500"
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
      >
        <X className="h-3 w-3" />
      </button>

      {isApple ? (
        /* iOS Safari instructions */
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Install CampusLink</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Get the full app experience with offline access and instant loading.
              </p>
            </div>
          </div>

          <div className="bg-muted/40 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">1</span>
              </div>
              <p className="text-xs text-foreground/80">
                Tap the <Share className="inline h-3.5 w-3.5 text-primary -mt-0.5" /> Share button in Safari
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">2</span>
              </div>
              <p className="text-xs text-foreground/80">
                Scroll down and tap <Plus className="inline h-3.5 w-3.5 text-primary -mt-0.5" /> <span className="font-semibold">Add to Home Screen</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">3</span>
              </div>
              <p className="text-xs text-foreground/80">
                Tap <span className="font-semibold">Add</span> — that's it!
              </p>
            </div>
          </div>

          {!isIOSSafari() && (
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Open in Safari for the best install experience
            </p>
          )}
        </div>
      ) : (
        /* Android/Chrome native install */
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Install CampusLink</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Add to your home screen for the full app experience — offline access, instant loading.
            </p>
            <button
              onClick={handleInstall}
              className="mt-2.5 h-8 px-4 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all"
            >
              Install App
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
