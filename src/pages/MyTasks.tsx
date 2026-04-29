import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Inbox, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Status = 'open' | 'in_progress' | 'completed';

type Applicant = { id: string; name: string; profile_picture: string | null };

type Task = {
  id: string;
  title: string;
  optional_price: number | null;
  due_date: string | null;
  created_at: string;
  status: Status;
  assigned_to: string | null;
  assignedProfile: Applicant | null;
  applicants: Applicant[]; // distinct commenters who aren't the owner
};

const TABS: { key: Status; label: string }[] = [
  { key: 'open', label: 'Posted' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

const STATUS_PILL: Record<Status, { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' },
};

const formatUrgency = (iso: string | null): { label: string; urgent: boolean } | null => {
  if (!iso) return null;
  const due = new Date(iso).getTime();
  const diffMs = due - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffMs < 0) return { label: 'Overdue', urgent: true };
  if (diffDays === 0) return { label: 'Due today', urgent: true };
  if (diffDays === 1) return { label: 'Due Tomorrow', urgent: true };
  if (diffDays <= 7) return { label: `Due in ${diffDays} days`, urgent: diffDays <= 2 };
  return { label: `Due ${format(new Date(iso), 'MMM d')}`, urgent: false };
};

const MyTasks = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Status>('open');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }

    const { data: postRows, error } = await supabase
      .from('posts')
      .select('id, title, optional_price, due_date, created_at, status, assigned_to, user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load tasks");
      setLoading(false);
      return;
    }

    const rows = (postRows ?? []) as any[];
    const ids = rows.map((p) => p.id);

    // ── Fetch applicants (distinct commenters per post, excluding owner) ──
    const applicantsByPost: Record<string, Applicant[]> = {};
    if (ids.length > 0) {
      const { data: comments } = await supabase
        .from('comments')
        .select('post_id, user_id')
        .in('post_id', ids)
        .neq('user_id', user.id);

      const userIds = Array.from(new Set((comments ?? []).map((c) => c.user_id)));

      let profilesById: Record<string, Applicant> = {};
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, name, profile_picture')
          .in('id', userIds);
        (profileRows ?? []).forEach((p: any) => {
          profilesById[p.id] = { id: p.id, name: p.name, profile_picture: p.profile_picture };
        });
      }

      const seen = new Set<string>();
      (comments ?? []).forEach((c) => {
        const key = `${c.post_id}:${c.user_id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const profile = profilesById[c.user_id];
        if (!profile) return;
        (applicantsByPost[c.post_id] ||= []).push(profile);
      });
    }

    // ── Fetch assigned-student profiles for in-progress / completed tasks ──
    const assignedIds = Array.from(
      new Set(rows.map((p) => p.assigned_to).filter((x): x is string => !!x))
    );
    const assignedById: Record<string, Applicant> = {};
    if (assignedIds.length > 0) {
      const { data: assignedRows } = await supabase
        .from('profiles')
        .select('id, name, profile_picture')
        .in('id', assignedIds);
      (assignedRows ?? []).forEach((p: any) => {
        assignedById[p.id] = { id: p.id, name: p.name, profile_picture: p.profile_picture };
      });
    }

    setTasks(
      rows.map((p) => ({
        id: p.id,
        title: p.title,
        optional_price: p.optional_price,
        due_date: p.due_date ?? null,
        created_at: p.created_at,
        status: (p.status ?? 'open') as Status,
        assigned_to: p.assigned_to ?? null,
        assignedProfile: p.assigned_to ? (assignedById[p.assigned_to] ?? null) : null,
        applicants: applicantsByPost[p.id] || [],
      }))
    );
    setLoading(false);
  };

  const filtered = useMemo(() => tasks.filter((t) => t.status === tab), [tasks, tab]);

  // ── Status transitions ──
  // open → in_progress: must pick an applicant first (Dialog)
  // in_progress → completed: instant (toast)
  // completed → open: revert (instant)
  const handleStatusTap = async (task: Task) => {
    if (task.status === 'open') {
      if (task.applicants.length === 0) {
        toast.info("Nobody has commented on this task yet — wait for an applicant before marking it in progress.");
        return;
      }
      setPickerTaskId(task.id);
      return;
    }
    if (task.status === 'in_progress') {
      await updateTask(task.id, { status: 'completed' });
      toast.success("Marked completed");
      return;
    }
    if (task.status === 'completed') {
      await updateTask(task.id, { status: 'open', assigned_to: null });
      toast.success("Reopened");
      return;
    }
  };

  const updateTask = async (postId: string, patch: { status?: Status; assigned_to?: string | null }) => {
    const previous = tasks.find((t) => t.id === postId);
    if (!previous) return;
    // Optimistic
    setTasks((prev) =>
      prev.map((t) =>
        t.id === postId
          ? {
              ...t,
              status: patch.status ?? t.status,
              assigned_to: patch.assigned_to !== undefined ? patch.assigned_to : t.assigned_to,
              // Clear assignedProfile if assignment cleared
              assignedProfile:
                patch.assigned_to === null
                  ? null
                  : patch.assigned_to
                  ? t.applicants.find((a) => a.id === patch.assigned_to) ?? t.assignedProfile
                  : t.assignedProfile,
            }
          : t
      )
    );
    const { error } = await supabase.from('posts').update(patch as any).eq('id', postId);
    if (error) {
      // Roll back
      setTasks((prev) => prev.map((t) => (t.id === postId ? previous : t)));
      toast.error("Couldn't update task");
    }
  };

  const pickerTask = tasks.find((t) => t.id === pickerTaskId) || null;
  const assignToApplicant = async (applicantId: string) => {
    if (!pickerTask) return;
    await updateTask(pickerTask.id, { status: 'in_progress', assigned_to: applicantId });
    setPickerTaskId(null);
    toast.success("Task moved to In Progress");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:block"><Navbar /></div>

      {/* Mobile header — back + centered title */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-12 px-2 grid grid-cols-[auto_1fr_auto] items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
            className="h-10 w-10 rounded-full hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[17px] font-semibold tracking-tight text-center">My Tasks</h1>
          <span className="w-10" aria-hidden />
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pb-32 lg:pt-[88px] lg:pb-12">
        <h1 className="hidden lg:block text-3xl font-bold tracking-tight pt-2 pb-4">My Tasks</h1>

        {/* Tabs */}
        <div className="flex items-center border-b border-border/40 mt-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 px-2 py-3 text-[13px] font-semibold transition-colors relative ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground/70'
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-[-1px] h-[2px] w-12 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="pt-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-[100px] rounded-2xl bg-muted/40 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              tab={tab}
              hasNoTasksAtAll={tasks.length === 0}
              onPostNew={() => navigate('/create-post')}
            />
          ) : (
            filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onOpen={() => navigate(`/post/${task.id}`)}
                onStatusTap={() => handleStatusTap(task)}
                onChat={() => task.assignedProfile && navigate(`/messages?userId=${task.assignedProfile.id}&postId=${task.id}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* Applicant picker — open only when moving Open → In Progress */}
      <Dialog open={pickerTaskId !== null} onOpenChange={(open) => !open && setPickerTaskId(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Who's helping with this task?</DialogTitle>
            <DialogDescription>
              Pick one of the students who commented. They'll show up under "In Progress" with a Chat shortcut.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border/40 -mx-2">
            {pickerTask?.applicants.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => assignToApplicant(a.id)}
                  className="w-full flex items-center gap-3 px-2 py-3 hover:bg-muted/40 rounded-lg transition-colors text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={a.profile_picture || ""} alt={a.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {a.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">{a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

// ─── Subcomponents ───

const EmptyState = ({
  tab,
  hasNoTasksAtAll,
  onPostNew,
}: {
  tab: Status;
  hasNoTasksAtAll: boolean;
  onPostNew: () => void;
}) => {
  // Big illustrated state — only when the user has *never* posted a task
  if (tab === 'open' && hasNoTasksAtAll) {
    return (
      <div className="flex flex-col items-center text-center pt-10 pb-6 px-4">
        <img
          src="/illustrations/empty-tasks.svg"
          alt=""
          aria-hidden="true"
          className="w-56 h-56 sm:w-64 sm:h-64 select-none pointer-events-none"
          draggable={false}
        />
        <h2 className="text-xl font-bold tracking-tight mt-4">No tasks yet</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-[280px] leading-relaxed">
          You haven't posted any tasks yet. Post a task and get help from other students.
        </p>
        <Button
          onClick={onPostNew}
          className="mt-6 h-[52px] px-10 rounded-2xl bg-primary hover:bg-primary/90 font-semibold text-[15px] shadow-md shadow-primary/25"
        >
          Post Your First Task
        </Button>
      </div>
    );
  }

  // Compact states for the other tabs
  return (
    <div className="rounded-2xl border border-border/40 p-10 text-center mt-2">
      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
        <Inbox className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="font-semibold text-sm mb-1">
        {tab === 'open' && 'No open tasks'}
        {tab === 'in_progress' && 'Nothing in progress'}
        {tab === 'completed' && 'Nothing completed yet'}
      </p>
      {tab === 'open' && (
        <p className="text-xs text-muted-foreground">
          <button onClick={onPostNew} className="text-primary font-semibold hover:underline">
            Post a task
          </button> to keep things moving
        </p>
      )}
    </div>
  );
};

const TaskCard = ({
  task,
  onOpen,
  onStatusTap,
  onChat,
}: {
  task: Task;
  onOpen: () => void;
  onStatusTap: () => void;
  onChat: () => void;
}) => {
  const urgency = task.status !== 'completed' ? formatUrgency(task.due_date) : null;
  const completedDate = task.status === 'completed' ? format(new Date(task.created_at), 'MMM d, yyyy') : null;
  const pill = STATUS_PILL[task.status];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className="bg-card border border-border/50 rounded-2xl p-4 cursor-pointer transition-colors hover:border-border active:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: title, price, urgency, optional student line */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] leading-snug text-foreground truncate">{task.title}</h3>
          <div className="flex items-baseline gap-2 mt-1.5">
            {task.optional_price != null && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[14px]">
                ₦{task.optional_price.toLocaleString()}
              </span>
            )}
            {urgency && (
              <span className={`text-[12px] font-semibold ${urgency.urgent ? 'text-red-500' : 'text-muted-foreground'}`}>
                {urgency.label}
              </span>
            )}
            {completedDate && (
              <span className="text-[12px] text-muted-foreground">{completedDate}</span>
            )}
          </div>

          {/* Student line — appears when there's an assignment (in_progress / completed) */}
          {task.assignedProfile && (
            <p className="text-[12px] text-muted-foreground mt-1.5">
              Student: <span className="font-semibold text-foreground/80">{task.assignedProfile.name}</span>
            </p>
          )}
        </div>

        {/* Right: differs by status */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {task.status === 'in_progress' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onChat(); }}
              className="h-8 px-3 rounded-full text-[12px] font-semibold border-primary/40 text-primary hover:bg-primary/5"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Chat
            </Button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusTap(); }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-opacity hover:opacity-80 ${pill.cls}`}
              title="Tap to change status"
            >
              {pill.label}
            </button>
          )}

          {task.status === 'open' && (
            <span className="text-[12px] text-muted-foreground whitespace-nowrap">
              {task.applicants.length} {task.applicants.length === 1 ? 'applicant' : 'applicants'}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default MyTasks;
