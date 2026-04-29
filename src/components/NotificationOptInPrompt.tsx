import { useEffect, useState } from "react";
import { Bell, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { isPushSupported, getPushPermission, subscribeToPush, describeSubscribeFailure } from "@/lib/pushNotifications";
import { toast } from "sonner";

const DISMISSED_KEY = "campuslink:notif_optin_dismissed_at";
const COOLDOWN_DAYS = 14; // don't re-show for 2 weeks if dismissed

interface NotificationOptInPromptProps {
  /** Triggers the dialog open. Caller is responsible for the trigger logic
   *  (e.g. Feed sets this to true after the user posts their first task). */
  trigger: boolean;
  onClose?: () => void;
  /** Override copy when the prompt is contextual (e.g. "after first task"). */
  context?: 'first_task' | 'first_message' | 'generic';
}

export const NotificationOptInPrompt = ({ trigger, onClose, context = 'generic' }: NotificationOptInPromptProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    if (!isPushSupported()) return;
    const perm = getPushPermission();
    // Already granted or already denied — don't re-prompt either way
    if (perm !== 'default') return;
    // Recently dismissed?
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const daysSince = (Date.now() - parseInt(dismissed, 10)) / 86_400_000;
      if (daysSince < COOLDOWN_DAYS) return;
    }
    setOpen(true);
  }, [trigger]);

  const handleEnable = async () => {
    setBusy(true);
    const result = await subscribeToPush();
    setBusy(false);
    if (result.ok) {
      toast.success("Notifications on. We'll let you know when something happens.");
      setOpen(false);
      onClose?.();
    } else {
      toast.error(describeSubscribeFailure(result.reason));
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
    onClose?.();
  };

  const copy = context === 'first_task'
    ? {
        title: "Turn on notifications?",
        body: "You just posted your first task — we'll ping you when someone applies.",
      }
    : context === 'first_message'
    ? {
        title: "Get notified for new messages?",
        body: "We'll let you know when someone replies, even when the app is closed.",
      }
    : {
        title: "Stay in the loop",
        body: "Get notified for new messages, applicants on your tasks, and updates.",
      };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 relative">
            <Bell className="h-6 w-6 text-primary" />
            <Sparkles className="h-3 w-3 text-amber-500 absolute -top-1 -right-1" />
          </div>
          <DialogTitle className="text-lg">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {copy.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-3">
          <Button
            onClick={handleEnable}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold shadow-md shadow-primary/20"
          >
            {busy ? "Enabling…" : "Turn on notifications"}
          </Button>
          <button
            onClick={handleDismiss}
            className="w-full h-10 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
