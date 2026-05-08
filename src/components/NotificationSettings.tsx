import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, MessageSquare, UserCheck, FileText, Mail, BellOff, Loader2, CheckCircle2, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  isPushSupported,
  isCurrentlySubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  describeSubscribeFailure,
} from "@/lib/pushNotifications";

type Prefs = {
  push_messages: boolean;
  push_comments: boolean;
  push_applicants: boolean;
  push_task_status: boolean;
  push_reengagement: boolean;
  email_fallback: boolean;
};

const DEFAULT_PREFS: Prefs = {
  push_messages: true,
  push_comments: true,
  push_applicants: true,
  push_task_status: true,
  push_reengagement: true,
  email_fallback: true,
};

const ROWS: { key: keyof Prefs; icon: typeof Bell; label: string; sub: string }[] = [
  { key: 'push_messages',     icon: MessageSquare, label: 'Messages',          sub: 'When someone sends you a message' },
  { key: 'push_applicants',   icon: UserCheck,     label: 'Applicants',        sub: 'When someone wants to help on your post' },
  { key: 'push_comments',     icon: MessageSquare, label: 'Comments',          sub: 'Replies on posts you follow' },
  { key: 'push_task_status',  icon: FileText,      label: 'Task updates',      sub: 'When a task you\'re on changes status' },
  { key: 'push_reengagement', icon: Bell,          label: 'Reminders & digest', sub: 'Weekly catch-up + gentle nudges' },
  { key: 'email_fallback',    icon: Mail,          label: 'Email fallback',    sub: 'Get an email if push isn\'t reaching you' },
];

export const NotificationSettings = () => {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pushOnDevice, setPushOnDevice] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    setPushSupported(isPushSupported());

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notification_preferences')
        .select('push_messages, push_comments, push_applicants, push_task_status, push_reengagement, email_fallback')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) setPrefs({ ...DEFAULT_PREFS, ...data });
      setLoading(false);

      if (isPushSupported()) {
        setPushOnDevice(await isCurrentlySubscribed());
      }
    })();
  }, []);

  const togglePref = async (key: keyof Prefs, value: boolean) => {
    setSaving(key);
    setPrefs((prev) => ({ ...prev, [key]: value })); // optimistic

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(null); return; }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, [key]: value });

    setSaving(null);
    if (error) {
      // Roll back
      setPrefs((prev) => ({ ...prev, [key]: !value }));
      toast.error("Couldn't save preference");
    }
  };

  const handleEnableDevice = async () => {
    setDeviceBusy(true);
    const result = await subscribeToPush();
    setDeviceBusy(false);
    if (result.ok) {
      setPushOnDevice(true);
      toast.success("Notifications enabled for this device");
    } else {
      toast.error(describeSubscribeFailure(result.reason));
    }
  };

  const handleDisableDevice = async () => {
    setDeviceBusy(true);
    try {
      await unsubscribeFromPush();
      setPushOnDevice(false);
      toast.success("This device unsubscribed");
    } catch {
      toast.error("Couldn't unsubscribe");
    } finally {
      setDeviceBusy(false);
    }
  };

  // Diagnostic — sends a notification to ourselves so we can verify the
  // chain end-to-end: trigger → notify_send_push → send-push edge fn →
  // notifications row + Web Push delivery + email fallback.
  const [testing, setTesting] = useState(false);
  const handleTest = async () => {
    setTesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in first"); setTesting(false); return; }
      const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
      const ANON = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token ?? ANON;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: user.id,
          type: "comment",
          title: "Test notification ✅",
          body: "If you see this, your notification pipeline is working.",
          data: { url: "/notifications", kind: "self_test" },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(`send-push returned ${res.status}: ${json?.error ?? "unknown"}`);
      } else {
        toast.success(`Test fired — pushSent: ${json?.pushSent ?? 0}, in-app inserted ✓`);
      }
    } catch (e: any) {
      toast.error(e.message || "Couldn't reach send-push");
    } finally { setTesting(false); }
  };

  return (
    <div className="p-4 bg-muted/20 space-y-4">
      {/* This-device card */}
      {pushSupported ? (
        <div className="rounded-xl bg-background border border-border/50 p-3.5 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            pushOnDevice ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
          }`}>
            {pushOnDevice ? <CheckCircle2 className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {pushOnDevice ? 'Notifications on for this device' : 'Notifications off on this device'}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {pushOnDevice
                ? 'You\'ll get OS-level alerts here'
                : 'Turn on to get push alerts on this browser'}
            </p>
          </div>
          {pushOnDevice ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisableDevice}
              disabled={deviceBusy}
              className="rounded-full text-xs h-8 px-3"
            >
              {deviceBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Turn off'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleEnableDevice}
              disabled={deviceBusy}
              className="rounded-full text-xs h-8 px-3 bg-primary hover:bg-primary/90"
            >
              {deviceBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Turn on'}
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-background border border-border/50 p-3.5 text-center">
          <p className="text-xs text-muted-foreground">
            This browser doesn't support push notifications.
            {' '}
            <span className="font-medium">Tip:</span> on iPhone, add CampusLink to your Home Screen.
          </p>
        </div>
      )}

      {/* Category toggles */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-2">
          What you get notified about
        </p>
        <div className="rounded-xl bg-background border border-border/50 divide-y divide-border/40 overflow-hidden">
          {ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.key} className="flex items-center gap-3 px-3.5 py-3">
                <Icon className="h-[18px] w-[18px] text-muted-foreground flex-shrink-0" strokeWidth={1.8} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{row.sub}</p>
                </div>
                <Switch
                  checked={prefs[row.key]}
                  disabled={loading || saving === row.key}
                  onCheckedChange={(checked) => togglePref(row.key, checked)}
                  aria-label={`Toggle ${row.label}`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground/60 px-1 mt-2 leading-relaxed">
          Toggling these only affects push notifications — the in-app feed shows everything regardless.
        </p>
      </div>

      {/* ─── Diagnostic ─── */}
      <div className="rounded-xl bg-background border border-border/50 p-3.5">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Notifications not arriving?</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Send a test to yourself to confirm the chain works. The bell badge
              should jump within 2 seconds; OS-level push depends on the device-on
              toggle above and your VAPID setup.
            </p>
          </div>
        </div>
        <Button
          onClick={handleTest}
          disabled={testing}
          variant="outline"
          size="sm"
          className="w-full rounded-lg h-9 text-xs font-semibold"
        >
          {testing ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Send className="h-3.5 w-3.5" />Send a test notification</span>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-2">
          Free tier: in-app notifications + Web Push (iOS 16.4+ on installed PWA only)
          + optional Resend email fallback (100/day free). No paid services required.
        </p>
      </div>
    </div>
  );
};
