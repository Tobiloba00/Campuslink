import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Bell, MessageSquare, Sparkles, ChevronRight, CheckCheck,
  AlertCircle, FileText, Calendar, UserCheck, Heart
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useNotifications, type NotificationRow } from "@/hooks/useNotifications";

const ICONS: Record<string, typeof Bell> = {
  message: MessageSquare,
  comment: MessageSquare,
  applicant: UserCheck,
  task_status: FileText,
  task_assigned: Sparkles,
  reengagement: Bell,
  overdue: AlertCircle,
  digest: Calendar,
  like: Heart,
};

const ICON_BG: Record<string, string> = {
  message: 'bg-blue-500/10 text-blue-500',
  comment: 'bg-blue-500/10 text-blue-500',
  applicant: 'bg-emerald-500/10 text-emerald-600',
  task_status: 'bg-violet-500/10 text-violet-600',
  task_assigned: 'bg-amber-500/10 text-amber-600',
  reengagement: 'bg-primary/10 text-primary',
  overdue: 'bg-red-500/10 text-red-500',
  digest: 'bg-emerald-500/10 text-emerald-600',
  like: 'bg-rose-500/10 text-rose-500',
};

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Notifications = () => {
  const navigate = useNavigate();
  const { items, unreadCount, loading, markAllRead, markRead } = useNotifications();

  const handleClick = (n: NotificationRow) => {
    if (!n.read_at) markRead(n.id);
    const url = (n.data?.url as string) || '/';
    navigate(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:block"><Navbar /></div>

      {/* Mobile header */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-12 px-2 grid grid-cols-[auto_1fr_auto] items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[17px] font-semibold tracking-tight text-center">Notifications</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="h-10 w-10 rounded-full hover:bg-muted disabled:opacity-30"
            aria-label="Mark all as read"
          >
            <CheckCheck className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-3 sm:px-5 pb-32 lg:pt-[88px] lg:pb-12">
        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between pt-2 pb-4">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-sm">
              <CheckCheck className="h-4 w-4 mr-1.5" /> Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border/40 p-12 text-center mt-2">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Bell className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-sm mb-1">No notifications yet</p>
            <p className="text-xs text-muted-foreground">
              You'll see new messages, applicants, and updates here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 mt-2">
            {items.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              const iconCls = ICON_BG[n.type] || 'bg-muted text-muted-foreground';
              const unread = !n.read_at;

              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-3 py-3 rounded-2xl transition-colors text-left ${
                      unread ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconCls}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[14px] truncate ${unread ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'}`}>
                          {n.title}
                        </p>
                        <time className="text-[11px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                          {formatRelative(n.created_at)}
                        </time>
                      </div>
                      {n.body && (
                        <p className="text-[13px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                      )}
                    </div>
                    {unread && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" aria-label="Unread" />
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-2 flex-shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Notifications;
