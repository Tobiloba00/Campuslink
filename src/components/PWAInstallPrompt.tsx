import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if user dismissed before (respect for 7 days)
    const dismissedAt = localStorage.getItem('pwa-dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 86400000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 30 seconds of usage
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

  if (!showBanner || dismissed || !deferredPrompt) return null;

  return (
    <div className={cn(
      "fixed bottom-20 lg:bottom-6 left-4 right-4 z-50 max-w-sm mx-auto",
      "bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl",
      "p-4 animate-in slide-in-from-bottom duration-500"
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center"
      >
        <X className="h-3 w-3" />
      </button>
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
    </div>
  );
}
