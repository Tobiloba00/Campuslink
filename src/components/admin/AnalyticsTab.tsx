import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Activity, Megaphone, Flag, TrendingUp, Loader2, Trophy,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

type Kpis = { total_users: number; dau: number; memos_today: number; reports_pending: number };
type DailyRow = { day: string; event_type: string; count: number; unique_users: number };
type SchoolRow = { id: string; name: string; events: number };

const COLORS = {
  primary: "hsl(221 83% 53%)",
  success: "hsl(142 71% 45%)",
  accent: "hsl(24 95% 53%)",
  muted: "hsl(220 13% 70%)",
};

export const AnalyticsTab = () => {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [growth, setGrowth] = useState<{ day: string; signups: number }[]>([]);
  const [engagement, setEngagement] = useState<{ day: string; sessions: number; views: number; created: number }[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since30 = subDays(startOfDay(new Date()), 30).toISOString().slice(0, 10);
      const since14 = subDays(startOfDay(new Date()), 14).toISOString().slice(0, 10);

      const [
        usersCount,
        dauResp,
        memosResp,
        reportsCount,
        signupsRes,
        engagementRes,
        topSchoolsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.rpc("kpi_dau"),
        supabase.rpc("kpi_memos_today"),
        supabase.from("memo_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("analytics_daily")
          .select("day, count")
          .eq("event_type", "user_signup")
          .gte("day", since30)
          .order("day", { ascending: true }),
        supabase.from("analytics_daily")
          .select("day, event_type, count, unique_users")
          .in("event_type", ["session_open", "memo_viewed", "memo_created"])
          .gte("day", since14)
          .order("day", { ascending: true }),
        supabase.from("analytics_daily")
          .select("school_id, count")
          .gte("day", subDays(startOfDay(new Date()), 7).toISOString().slice(0, 10))
          .not("school_id", "is", null),
      ]);

      if (cancelled) return;

      setKpis({
        total_users: usersCount.count ?? 0,
        dau: dauResp.data ?? 0,
        memos_today: memosResp.data ?? 0,
        reports_pending: reportsCount.count ?? 0,
      });

      // Growth — collapse per-school rows into platform totals per day
      const sumByDay = new Map<string, number>();
      (signupsRes.data ?? []).forEach((r: any) => {
        sumByDay.set(r.day, (sumByDay.get(r.day) ?? 0) + r.count);
      });
      const growthArr = [...sumByDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, signups]) => ({ day: format(new Date(day), "MMM d"), signups }));
      setGrowth(growthArr);

      // Engagement — group by day, with one column per event type
      type EngagementBuilder = { day: string; sessions: number; views: number; created: number };
      const engagementMap = new Map<string, EngagementBuilder>();
      (engagementRes.data ?? []).forEach((r: any) => {
        const cur = engagementMap.get(r.day) ?? { day: r.day, sessions: 0, views: 0, created: 0 };
        if (r.event_type === "session_open") cur.sessions += r.unique_users;
        else if (r.event_type === "memo_viewed") cur.views += r.count;
        else if (r.event_type === "memo_created") cur.created += r.count;
        engagementMap.set(r.day, cur);
      });
      setEngagement(
        [...engagementMap.values()]
          .sort((a, b) => a.day.localeCompare(b.day))
          .map((r) => ({ ...r, day: format(new Date(r.day), "MMM d") }))
      );

      // Top schools by event count last 7 days
      const schoolEvents = new Map<string, number>();
      (topSchoolsRes.data ?? []).forEach((r: any) => {
        if (!r.school_id) return;
        schoolEvents.set(r.school_id, (schoolEvents.get(r.school_id) ?? 0) + r.count);
      });
      const topIds = [...schoolEvents.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => id);
      if (topIds.length > 0) {
        const { data: schools } = await supabase.from("schools")
          .select("id, name").in("id", topIds);
        const ranked: SchoolRow[] = (schools ?? [])
          .map((s: any) => ({ id: s.id, name: s.name, events: schoolEvents.get(s.id) ?? 0 }))
          .sort((a, b) => b.events - a.events);
        setSchools(ranked);
      } else {
        setSchools([]);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || !kpis) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Aggregated from event log. Refreshes every 15 minutes.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users}     label="Total Users"      value={kpis.total_users}     color="text-primary bg-primary/10" />
        <KpiCard icon={Activity}  label="Active Today"     value={kpis.dau}             color="text-emerald-600 bg-emerald-500/10" />
        <KpiCard icon={Megaphone} label="Memos Today"      value={kpis.memos_today}     color="text-violet-600 bg-violet-500/10" />
        <KpiCard icon={Flag}      label="Reports Pending"  value={kpis.reports_pending} color="text-red-600 bg-red-500/10" />
      </div>

      {/* Growth */}
      <ChartCard title="User growth — last 30 days" icon={TrendingUp}>
        {growth.length === 0 ? (
          <EmptyChart hint="No signups in the last 30 days." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={growth} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="signups" stroke={COLORS.primary} strokeWidth={2.5}
                    dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Engagement */}
      <ChartCard title="Engagement — last 14 days" icon={Activity}>
        {engagement.length === 0 ? (
          <EmptyChart hint="No engagement events yet — start using the app." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={engagement} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sessions" name="Sessions"     stackId="a" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="views"    name="Memo views"   stackId="a" fill={COLORS.success} />
              <Bar dataKey="created"  name="Memos created" stackId="a" fill={COLORS.accent}  />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Top schools */}
      <ChartCard title="Most active schools — last 7 days" icon={Trophy}>
        {schools.length === 0 ? (
          <EmptyChart hint="No school activity yet." />
        ) : (
          <ul className="divide-y divide-border/40">
            {schools.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium text-sm truncate">{s.name}</span>
                <span className="text-sm font-semibold tabular-nums">{s.events.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">events</span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
};

const KpiCard = ({
  icon: Icon, label, value, color,
}: { icon: any; label: string; value: number; color: string }) => (
  <div className="rounded-2xl bg-card border border-border/40 p-4">
    <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-2.5 ${color}`}>
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-2xl font-bold leading-none tabular-nums">{value.toLocaleString()}</p>
    <p className="text-xs font-semibold text-muted-foreground mt-1.5">{label}</p>
  </div>
);

const ChartCard = ({
  title, icon: Icon, children,
}: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="rounded-2xl bg-card border border-border/40 p-4">
    <h3 className="text-sm font-bold tracking-tight mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </h3>
    {children}
  </div>
);

const EmptyChart = ({ hint }: { hint: string }) => (
  <div className="py-10 text-center text-xs text-muted-foreground">{hint}</div>
);

export default AnalyticsTab;
