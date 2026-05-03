import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Trash2, Users, FileText, ShieldCheck, Megaphone, Building2, Flag, Check, X, Loader2,
  LayoutDashboard, Activity, Plus, ChevronRight, ArrowRight, Bell,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow, format, startOfDay } from "date-fns";

const Admin = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles")
        .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!data) { toast.error("Access denied"); navigate("/"); return; }
      setIsAdmin(true);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+7rem)] pb-24 lg:pb-8 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="overflow-x-auto scrollbar-hide flex-wrap h-auto justify-start">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="applications" className="gap-2"><ShieldCheck className="h-4 w-4" />Applications</TabsTrigger>
            <TabsTrigger value="publishers" className="gap-2"><Megaphone className="h-4 w-4" />Publishers</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><Flag className="h-4 w-4" />Reports</TabsTrigger>
            <TabsTrigger value="schools" className="gap-2"><Building2 className="h-4 w-4" />Schools</TabsTrigger>
            <TabsTrigger value="posts" className="gap-2"><FileText className="h-4 w-4" />Posts</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Users</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="applications"><ApplicationsTab /></TabsContent>
          <TabsContent value="publishers"><PublishersTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="schools"><SchoolsTab /></TabsContent>
          <TabsContent value="posts"><PostsTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   DashboardTab — overview matching the design mockup
   ──────────────────────────────────────────────────────────── */
const DashboardTab = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingApps: 0,
    activePublishers: 0,
    memosToday: 0,
    pendingReports: 0,
    activeSchools: 0,
  });
  const [pendingApps, setPendingApps] = useState<any[]>([]);
  const [verifiedPubs, setVerifiedPubs] = useState<any[]>([]);
  const [flaggedReports, setFlaggedReports] = useState<any[]>([]);
  const [recentMemos, setRecentMemos] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [adminName, setAdminName] = useState("Admin");
  const [adminPic, setAdminPic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = startOfDay(new Date()).toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles").select("name, profile_picture")
          .eq("id", user.id).single();
        if (profile) { setAdminName(profile.name || "Admin"); setAdminPic(profile.profile_picture); }
      }

      // Counts (run in parallel)
      const [
        { count: pendingApps },
        { count: activePublishers },
        { count: memosToday },
        { count: pendingReports },
        { count: activeSchools },
      ] = await Promise.all([
        supabase.from("publisher_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("publishers").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("memos").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("memo_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("schools").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        pendingApps: pendingApps ?? 0,
        activePublishers: activePublishers ?? 0,
        memosToday: memosToday ?? 0,
        pendingReports: pendingReports ?? 0,
        activeSchools: activeSchools ?? 0,
      });

      // Lists (top items)
      const [{ data: apps }, { data: pubs }, { data: rs }, { data: ms }] = await Promise.all([
        supabase.from("publisher_applications")
          .select("*, profiles:user_id (name, profile_picture), schools:school_id (name)")
          .eq("status", "pending").order("created_at", { ascending: false }).limit(3),
        supabase.from("publishers")
          .select("id, role, status, verified_at, profiles:user_id (name, profile_picture), schools:school_id (name)")
          .eq("status", "active").order("verified_at", { ascending: false }).limit(4),
        supabase.from("memo_reports")
          .select("*, profiles:reporter_id (name)")
          .eq("status", "pending").order("created_at", { ascending: false }).limit(3),
        supabase.from("memos")
          .select("id, title, urgency, created_at, publishers!inner(role, profiles:user_id (name))")
          .order("created_at", { ascending: false }).limit(4),
      ]);

      setPendingApps(apps || []);
      setVerifiedPubs(pubs || []);
      setFlaggedReports(rs || []);
      setRecentMemos(ms || []);

      // Activity feed: synthesize from recent rows
      const events: any[] = [];
      (apps || []).slice(0, 2).forEach((a) =>
        events.push({ icon: ShieldCheck, text: `New application from ${a.profiles?.name || "unknown"}`,
                      time: a.created_at, color: "text-primary bg-primary/10" }));
      (rs || []).slice(0, 2).forEach((r) =>
        events.push({ icon: Flag, text: `New ${r.target_type} report (${r.reason})`,
                      time: r.created_at, color: "text-red-600 bg-red-500/10" }));
      (ms || []).slice(0, 2).forEach((m) =>
        events.push({ icon: Megaphone, text: `New memo: "${m.title}"`,
                      time: m.created_at, color: "text-emerald-600 bg-emerald-500/10" }));
      events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivity(events.slice(0, 6));

      setLoading(false);
    })();
  }, []);

  const approve = async (id: string) => {
    const { error } = await supabase.rpc("approve_publisher_application", { p_app_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Approved");
    setPendingApps((prev) => prev.filter((a) => a.id !== id));
    setStats((s) => ({ ...s, pendingApps: Math.max(0, s.pendingApps - 1), activePublishers: s.activePublishers + 1 }));
  };

  const reject = async (id: string) => {
    const reason = prompt("Reason for rejection?") || "Rejected";
    const { error } = await supabase.rpc("reject_publisher_application", { p_app_id: id, p_reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected");
    setPendingApps((prev) => prev.filter((a) => a.id !== id));
    setStats((s) => ({ ...s, pendingApps: Math.max(0, s.pendingApps - 1) }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/85 text-white p-5 flex items-center gap-4">
        <Avatar className="h-12 w-12 ring-2 ring-white/30">
          <AvatarImage src={adminPic || ""} />
          <AvatarFallback className="bg-white/20 text-white text-base font-bold">
            {adminName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold leading-tight">
            Welcome back, {adminName.split(" ")[0]} <span className="inline-block">👋</span>
          </h2>
          <p className="text-sm text-white/80 leading-relaxed">
            Monitor applications, memos, and platform activity in real-time
          </p>
        </div>
        <div className="hidden sm:flex gap-2 flex-shrink-0">
          <Button onClick={() => navigate("/admin")} variant="secondary" size="sm"
                  className="rounded-full text-xs font-semibold bg-white text-primary hover:bg-white/90">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Approve Publishers
          </Button>
          <Button onClick={() => navigate("/memos/new")} size="sm"
                  className="rounded-full text-xs font-semibold bg-white/15 text-white hover:bg-white/25">
            <Plus className="h-3.5 w-3.5 mr-1" />Create Memo
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={ShieldCheck} label="Pending Apps" value={stats.pendingApps}
                  hint={stats.pendingApps > 0 ? `${stats.pendingApps} awaiting review` : "All caught up"}
                  color="text-primary bg-primary/10" />
        <StatCard icon={Check} label="Active Publishers" value={stats.activePublishers}
                  hint="Across all schools" color="text-emerald-600 bg-emerald-500/10" />
        <StatCard icon={Megaphone} label="Memos Today" value={stats.memosToday}
                  hint="In the last 24h" color="text-violet-600 bg-violet-500/10" />
        <StatCard icon={Flag} label="Reports" value={stats.pendingReports}
                  hint={stats.pendingReports > 0 ? "Needs review" : "Nothing flagged"}
                  color="text-red-600 bg-red-500/10" />
        <StatCard icon={Building2} label="Schools" value={stats.activeSchools}
                  hint="Active campuses" color="text-amber-600 bg-amber-500/10" />
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col — pending apps + flagged reports */}
        <div className="lg:col-span-2 space-y-5">
          <Section title="Pending Applications" count={stats.pendingApps} viewAllTab="applications">
            {pendingApps.length === 0 ? (
              <EmptyHint title="No pending applications" />
            ) : (
              <div className="space-y-2.5">
                {pendingApps.map((a) => (
                  <div key={a.id} className="rounded-xl bg-card border border-border/40 p-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={a.profiles?.profile_picture || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {a.profiles?.name?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{a.profiles?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {roleLabel(a.requested_role)} · {a.schools?.name || "—"}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.proof_screenshot_url && <ProofChip>Screenshot</ProofChip>}
                        {a.proof_whatsapp_link && <ProofChip>WhatsApp</ProofChip>}
                        {a.proof_email && <ProofChip>Email</ProofChip>}
                        {a.proof_reference_name && <ProofChip>Reference</ProofChip>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button onClick={() => approve(a.id)} size="sm"
                              className="rounded-lg h-7 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                        Approve
                      </Button>
                      <Button onClick={() => reject(a.id)} size="sm" variant="outline"
                              className="rounded-lg h-7 px-3 text-xs font-semibold border-red-500/30 text-red-600 hover:bg-red-500/5">
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Flagged Reports" count={stats.pendingReports} viewAllTab="reports">
            {flaggedReports.length === 0 ? (
              <EmptyHint title="No flagged content" />
            ) : (
              <div className="space-y-2">
                {flaggedReports.map((r) => (
                  <div key={r.id} className="rounded-xl bg-card border border-border/40 p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Flag className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold capitalize truncate">
                        {r.target_type} report — {r.reason}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        by {r.profiles?.name || "Unknown"} ·
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Button onClick={() => navigate("/admin")} size="sm" variant="outline"
                            className="rounded-lg h-7 text-xs font-semibold flex-shrink-0">
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Right col — verified publishers, recent memos, activity, status */}
        <div className="space-y-5">
          <Section title="Verified Publishers" count={stats.activePublishers} viewAllTab="publishers" compact>
            {verifiedPubs.length === 0 ? (
              <EmptyHint title="No verified publishers yet" />
            ) : (
              <ul className="space-y-2">
                {verifiedPubs.map((p) => (
                  <li key={p.id} className="rounded-xl bg-card border border-border/40 p-3 flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.profiles?.profile_picture || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {p.profiles?.name?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.profiles?.name || "Unknown"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.schools?.name}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                      Verified
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent Memos" viewAllTab={null} compact>
            {recentMemos.length === 0 ? (
              <EmptyHint title="No memos yet" />
            ) : (
              <ul className="space-y-2">
                {recentMemos.map((m) => (
                  <li key={m.id} onClick={() => navigate(`/memos/${m.id}`)}
                      className="rounded-xl bg-card border border-border/40 p-3 cursor-pointer hover:border-primary/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        m.urgency === "urgent" ? "bg-red-500/10 text-red-600" :
                        m.urgency === "important" ? "bg-amber-500/10 text-amber-600" :
                        "bg-primary/10 text-primary"
                      }`}>{m.urgency}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-bold truncate">{m.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Activity Feed" viewAllTab={null} compact>
            {activity.length === 0 ? (
              <EmptyHint title="Quiet around here" />
            ) : (
              <ul className="space-y-2">
                {activity.map((e, i) => {
                  const Icon = e.icon;
                  return (
                    <li key={i} className="flex items-center gap-2.5 rounded-xl bg-card border border-border/40 p-3">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${e.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{e.text}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(e.time), { addSuffix: true })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="System Status" viewAllTab={null} compact>
            <div className="rounded-xl bg-card border border-border/40 divide-y divide-border/40">
              <SystemRow label="AI Service" status="operational" />
              <SystemRow label="Notifications" status="operational" />
              <SystemRow label="Storage" status="operational" />
              <SystemRow label="Realtime" status="operational" />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon, label, value, hint, color,
}: { icon: any; label: string; value: number; hint: string; color: string }) => (
  <div className="rounded-2xl bg-card border border-border/40 p-3.5">
    <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-2xl font-bold leading-none">{value}</p>
    <p className="text-[11px] font-semibold text-muted-foreground mt-1">{label}</p>
    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>
  </div>
);

const Section = ({
  title, count, viewAllTab, compact = false, children,
}: { title: string; count?: number; viewAllTab: string | null; compact?: boolean; children: React.ReactNode }) => {
  const switchTab = (v: string) => {
    const tab = document.querySelector(`[data-state][value="${v}"]`) as HTMLButtonElement | null;
    tab?.click();
  };
  return (
    <div>
      <div className={`flex items-center justify-between ${compact ? "mb-2" : "mb-3"}`}>
        <h3 className={`font-bold tracking-tight ${compact ? "text-sm" : "text-base"}`}>
          {title}
          {count != null && count > 0 && (
            <span className="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </h3>
        {viewAllTab && (
          <button onClick={() => switchTab(viewAllTab)}
                  className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5">
            View all<ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

const ProofChip = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
    {children}
  </span>
);

const EmptyHint = ({ title }: { title: string }) => (
  <div className="rounded-xl border border-border/30 bg-card p-6 text-center">
    <p className="text-xs text-muted-foreground">{title}</p>
  </div>
);

const SystemRow = ({ label, status }: { label: string; status: "operational" | "degraded" | "down" }) => {
  const dotColor = status === "operational" ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center justify-between p-3">
      <span className="text-xs font-medium">{label}</span>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold capitalize">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />{status}
      </span>
    </div>
  );
};

const roleLabel = (r: string) =>
  r === "student_union" ? "Student Union" : r === "school_admin" ? "School Admin" : r;

/* ─── Tab: Publisher applications ─── */
const ApplicationsTab = () => {
  const [apps, setApps] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("publisher_applications")
      .select("*, profiles:user_id (name, email), schools:school_id (name), faculties:faculty_id (name), departments:department_id (name)")
      .order("created_at", { ascending: false });
    setApps(data || []);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("approve_publisher_application", { p_app_id: id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Approved");
    load();
  };

  const reject = async (id: string) => {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;
    setBusy(id);
    const { error } = await supabase.rpc("reject_publisher_application", { p_app_id: id, p_reason: reason });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected");
    load();
  };

  return (
    <div className="space-y-3">
      {apps.length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
      {apps.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{a.profiles?.name || "Unknown"} ({a.profiles?.email})</p>
                <p className="text-xs text-muted-foreground">
                  Wants <span className="font-semibold">{a.requested_role.replace("_"," ")}</span> at {a.schools?.name}
                  ({a.requested_scope}{a.faculties?.name ? ` · ${a.faculties.name}` : ""}{a.departments?.name ? ` · ${a.departments.name}` : ""})
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Submitted {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                a.status === "pending" ? "bg-amber-500/10 text-amber-600" :
                a.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                "bg-red-500/10 text-red-600"
              }`}>{a.status}</span>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
              {a.proof_email && <p><span className="font-semibold">Email:</span> {a.proof_email}</p>}
              {a.proof_whatsapp_link && <p><span className="font-semibold">WhatsApp:</span> {a.proof_whatsapp_link}</p>}
              {a.proof_reference_name && <p><span className="font-semibold">Reference:</span> {a.proof_reference_name}</p>}
              {a.applicant_notes && <p><span className="font-semibold">Notes:</span> {a.applicant_notes}</p>}
            </div>

            {a.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve(a.id)} disabled={busy === a.id}
                        className="flex-1 rounded-lg"><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                <Button size="sm" variant="outline" onClick={() => reject(a.id)} disabled={busy === a.id}
                        className="flex-1 rounded-lg"><X className="h-3.5 w-3.5 mr-1" />Reject</Button>
              </div>
            )}
            {a.status === "rejected" && a.rejection_reason && (
              <p className="text-xs text-red-600">Rejected: {a.rejection_reason}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/* ─── Tab: Publishers ─── */
const PublishersTab = () => {
  const [pubs, setPubs] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("publishers")
      .select("*, profiles:user_id (name, email), schools:school_id (name)")
      .order("verified_at", { ascending: false });
    setPubs(data || []);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const reason = status === "restricted" || status === "revoked" ? prompt(`${status} reason?`) : null;
    const update: any = { status, restriction_reason: reason };
    if (status === "active") update.restricted_until = null;
    await supabase.from("publishers").update(update).eq("id", id);
    toast.success(`Set to ${status}`);
    load();
  };

  return (
    <div className="space-y-3">
      {pubs.length === 0 && <p className="text-sm text-muted-foreground">No publishers yet.</p>}
      {pubs.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-sm">{p.profiles?.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.role.replace("_"," ")} · {p.scope} · {p.schools?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                p.status === "active" ? "bg-emerald-500/10 text-emerald-600" :
                p.status === "restricted" ? "bg-amber-500/10 text-amber-600" :
                "bg-red-500/10 text-red-600"
              }`}>{p.status}</span>
              <Select onValueChange={(v) => setStatus(p.id, v)}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activate</SelectItem>
                  <SelectItem value="restricted">Restrict</SelectItem>
                  <SelectItem value="revoked">Revoke</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/* ─── Tab: Reports ─── */
const ReportsTab = () => {
  const [reports, setReports] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("memo_reports")
      .select("*, profiles:reporter_id (name)")
      .order("created_at", { ascending: false });
    setReports(data || []);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string, action: "reviewed" | "dismissed") => {
    await supabase.from("memo_reports").update({
      status: action, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    toast.success(`Marked ${action}`);
    load();
  };

  return (
    <div className="space-y-3">
      {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports.</p>}
      {reports.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">
                {r.target_type} reported for {r.reason}
              </p>
              <p className="text-xs text-muted-foreground">
                by {r.profiles?.name || "Unknown"} ·
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </p>
              {r.details && <p className="text-xs mt-1">{r.details}</p>}
              <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">{r.target_id}</p>
            </div>
            {r.status === "pending" && (
              <div className="flex flex-col gap-1.5">
                <Button size="sm" variant="outline" onClick={() => resolve(r.id, "reviewed")} className="text-xs h-7">Review</Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(r.id, "dismissed")} className="text-xs h-7">Dismiss</Button>
              </div>
            )}
            {r.status !== "pending" && (
              <span className="text-[10px] font-bold uppercase text-muted-foreground">{r.status}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/* ─── Tab: Schools / Faculties / Departments ─── */
const SchoolsTab = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState("NG");
  const [domain, setDomain] = useState("");

  const [activeSchool, setActiveSchool] = useState<string>("");
  const [faculties, setFaculties] = useState<any[]>([]);
  const [facultyName, setFacultyName] = useState("");

  const [activeFaculty, setActiveFaculty] = useState<string>("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptName, setDeptName] = useState("");

  useEffect(() => {
    supabase.from("schools").select("*").order("name").then(({ data }) => setSchools(data || []));
  }, []);

  useEffect(() => {
    if (!activeSchool) return;
    supabase.from("faculties").select("*").eq("school_id", activeSchool).order("name")
      .then(({ data }) => setFaculties(data || []));
  }, [activeSchool]);

  useEffect(() => {
    if (!activeFaculty) return;
    supabase.from("departments").select("*").eq("faculty_id", activeFaculty).order("name")
      .then(({ data }) => setDepartments(data || []));
  }, [activeFaculty]);

  const addSchool = async () => {
    if (!name || !slug) { toast.error("Name and slug required"); return; }
    const { data, error } = await supabase.from("schools").insert({
      name, slug: slug.toLowerCase(), country: country || null, domain: domain || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setSchools((prev) => [...prev, data]);
    setName(""); setSlug(""); setDomain("");
    toast.success("School added");
  };

  const addFaculty = async () => {
    if (!activeSchool || !facultyName) return;
    const { data, error } = await supabase.from("faculties")
      .insert({ school_id: activeSchool, name: facultyName }).select().single();
    if (error) { toast.error(error.message); return; }
    setFaculties((prev) => [...prev, data]);
    setFacultyName("");
  };

  const addDept = async () => {
    if (!activeFaculty || !deptName) return;
    const { data, error } = await supabase.from("departments")
      .insert({ faculty_id: activeFaculty, name: deptName }).select().single();
    if (error) { toast.error(error.message); return; }
    setDepartments((prev) => [...prev, data]);
    setDeptName("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Add school</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="University of Lagos" className="h-10" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="unilag" className="h-10" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="NG" className="h-10" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Email domain</Label><Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="unilag.edu.ng" className="h-10" /></div>
          <Button onClick={addSchool} className="col-span-2 rounded-xl">Add school</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Faculties</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={activeSchool} onValueChange={setActiveSchool}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Pick a school" /></SelectTrigger>
            <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          {activeSchool && (
            <>
              <div className="flex gap-2">
                <Input value={facultyName} onChange={(e) => setFacultyName(e.target.value)} placeholder="Faculty name (e.g. Engineering)" className="h-10" />
                <Button onClick={addFaculty} className="rounded-xl">Add</Button>
              </div>
              <ul className="text-sm space-y-1">
                {faculties.map((f) => <li key={f.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">{f.name}</li>)}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Departments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={activeFaculty} onValueChange={setActiveFaculty}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Pick a faculty" /></SelectTrigger>
            <SelectContent>{faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
          {activeFaculty && (
            <>
              <div className="flex gap-2">
                <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Department name (e.g. Computer Science)" className="h-10" />
                <Button onClick={addDept} className="rounded-xl">Add</Button>
              </div>
              <ul className="text-sm space-y-1">
                {departments.map((d) => <li key={d.id} className="py-1 border-b border-border/30 last:border-0">{d.name}</li>)}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Existing tabs (Posts / Users) ─── */
const PostsTab = () => {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("posts").select("*, profiles (name)").order("created_at", { ascending: false }).limit(100);
    setPosts(data || []);
  })(); }, []);
  const del = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) { toast.error("Failed"); return; }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <Card key={post.id}>
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{post.title}</p>
              <p className="text-xs text-muted-foreground">By {post.profiles?.name} · {post.category}</p>
              <p className="text-sm mt-1 line-clamp-2">{post.description}</p>
            </div>
            <Button size="icon" variant="destructive" onClick={() => del(post.id)} className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const UsersTab = () => {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    setUsers(data || []);
  })(); }, []);
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((u) => (
        <Card key={u.id}>
          <CardContent className="p-4">
            <p className="font-bold text-sm">{u.name}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
            {u.course && <p className="text-xs">Course: {u.course}</p>}
            <p className="text-xs">Rating: {u.rating?.toFixed(1) ?? "—"}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default Admin;
