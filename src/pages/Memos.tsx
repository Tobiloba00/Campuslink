import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import {
  Megaphone, AlertCircle, AlertTriangle, ChevronRight, ShieldCheck, Plus, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Memo = {
  id: string;
  title: string;
  body: string;
  urgency: "urgent" | "important" | "general";
  created_at: string;
  ai_summary: string | null;
  publisher_id: string;
};

type PubInfo = {
  id: string;
  display_name: string | null;
  role: string;
  status: string;
  scope: string;
  user: { name: string | null } | null;
};

const URGENCY_META = {
  urgent:    { icon: AlertCircle,    color: "text-red-600",   bg: "bg-red-500/10",   border: "border-red-500/30",   label: "URGENT"    },
  important: { icon: AlertTriangle,  color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "IMPORTANT" },
  general:   { icon: Megaphone,      color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/20",   label: "GENERAL"   },
};

const Memos = () => {
  const navigate = useNavigate();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [pubMap, setPubMap] = useState<Record<string, PubInfo>>({});
  const [loading, setLoading] = useState(true);
  const [hasProfileSetup, setHasProfileSetup] = useState(true);
  const [activePub, setActivePub] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      // Check the user has school setup
      const { data: profile } = await supabase
        .from("profiles").select("school_id, faculty_id, department_id, level")
        .eq("id", user.id).single();
      if (!profile?.school_id) {
        setHasProfileSetup(false);
        setLoading(false);
        return;
      }

      // Are they an active publisher?
      const { data: pub } = await supabase.from("publishers").select("*")
        .eq("user_id", user.id).eq("status", "active").maybeSingle();
      setActivePub(pub);

      // Fetch memos that RLS lets us see, plus publisher info
      const { data: memoRows } = await supabase
        .from("memos")
        .select("id, title, body, urgency, created_at, ai_summary, publisher_id")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(50);
      setMemos((memoRows as Memo[]) || []);

      // Hydrate publishers
      const ids = [...new Set((memoRows || []).map((m) => m.publisher_id))];
      if (ids.length > 0) {
        const { data: pubs } = await supabase
          .from("publishers")
          .select("id, display_name, role, status, scope, user:user_id (name)")
          .in("id", ids);
        const map: Record<string, PubInfo> = {};
        (pubs || []).forEach((p: any) => { map[p.id] = p; });
        setPubMap(map);
      }
      setLoading(false);

      // Realtime: prepend new memos
      const channel = supabase
        .channel("memos-feed")
        .on("postgres_changes",
            { event: "INSERT", schema: "public", table: "memos" },
            async (payload) => {
              const nm = payload.new as any;
              const { data } = await supabase.from("memos")
                .select("id, title, body, urgency, created_at, ai_summary, publisher_id")
                .eq("id", nm.id).single();
              if (!data) return;
              setMemos((prev) => prev.find((m) => m.id === data.id) ? prev : [data as Memo, ...prev]);
            })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    })();
  }, [navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!hasProfileSetup) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-xl mx-auto px-5 pt-[calc(env(safe-area-inset-top,0px)+76px)] pb-32 lg:pb-12">
          <div className="rounded-2xl border border-border/40 bg-card p-8 text-center mt-8">
            <Megaphone className="h-7 w-7 text-muted-foreground/50 mx-auto mb-3" />
            <p className="font-semibold mb-1">Set up your school first</p>
            <p className="text-xs text-muted-foreground mb-4">
              Memos are filtered to your school, faculty, department, and level.
            </p>
            <Button onClick={() => navigate("/profile")} className="rounded-full">Go to profile</Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-xl mx-auto px-5 pt-[calc(env(safe-area-inset-top,0px)+76px)] pb-32 lg:pb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight leading-tight">Memos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Official notices for your school, faculty, and level.
            </p>
          </div>
          {activePub && (
            <Button onClick={() => navigate("/memos/new")} size="sm"
                    className="rounded-full text-xs font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          )}
        </div>

        {!activePub && (
          <Link to="/apply-publisher" className="block mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Got an SUG or admin role?</p>
                <p className="text-xs text-muted-foreground">Apply to post official memos.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        )}

        {memos.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card p-12 text-center mt-2">
            <Megaphone className="h-7 w-7 text-muted-foreground/50 mx-auto mb-3" />
            <p className="font-semibold mb-1">No memos yet</p>
            <p className="text-xs text-muted-foreground">
              When your school posts something, it'll show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {memos.map((m) => {
              const meta = URGENCY_META[m.urgency];
              const Icon = meta.icon;
              const pub = pubMap[m.publisher_id];
              return (
                <li key={m.id}>
                  <Link to={`/memos/${m.id}`}
                        className={`block rounded-2xl bg-card border ${meta.border} p-4 hover:shadow-md transition-all`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${meta.color} ${meta.bg}`}>
                        <Icon className="h-3 w-3" />{meta.label}
                      </span>
                      {pub && (
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 truncate">
                          <ShieldCheck className="h-3 w-3 text-primary flex-shrink-0" />
                          {pub.display_name || pub.user?.name || roleLabel(pub.role)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-base leading-snug">{m.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {m.ai_summary || m.body.slice(0, 180)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-2">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </Link>
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

const roleLabel = (r: string) => r === "student_union" ? "Student Union" : r === "school_admin" ? "School Admin" : r;

export default Memos;
