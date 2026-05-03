import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Megaphone, Loader2, Plus, Trash2, AlertCircle, AlertTriangle, Info,
} from "lucide-react";

type Pub = {
  id: string; school_id: string; role: string; scope: string;
  faculty_id: string | null; department_id: string | null;
};

type TargetDraft = {
  target_type: "school" | "faculty" | "department" | "level";
  faculty_id?: string | null;
  department_id?: string | null;
  level?: number | null;
};

const URGENCIES = [
  { value: "general", label: "General", icon: Info, color: "text-muted-foreground bg-muted/50" },
  { value: "important", label: "Important", icon: AlertTriangle, color: "text-amber-600 bg-amber-500/10" },
  { value: "urgent", label: "Urgent", icon: AlertCircle, color: "text-red-600 bg-red-500/10" },
] as const;

const CreateMemo = () => {
  const navigate = useNavigate();
  const [pub, setPub] = useState<Pub | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState<"general" | "important" | "urgent">("general");
  const [targets, setTargets] = useState<TargetDraft[]>([]);

  const [faculties, setFaculties] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data } = await supabase.from("publishers").select("*")
        .eq("user_id", user.id).eq("status", "active").maybeSingle();
      if (!data) { toast.error("You're not an active publisher"); navigate("/profile"); return; }
      setPub(data as Pub);

      // Pre-load faculties (publisher's whole school) for target picker
      const { data: fac } = await supabase.from("faculties").select("id, name")
        .eq("school_id", data.school_id).order("name");
      setFaculties(fac || []);
      // Departments depend on selected faculty in target rows; will fetch on demand
      // but for simplicity preload all depts under all faculties of that school:
      if (fac && fac.length > 0) {
        const { data: deps } = await supabase.from("departments").select("id, name, faculty_id")
          .in("faculty_id", fac.map((f) => f.id));
        setDepartments(deps || []);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const addTarget = () => {
    if (!pub) return;
    if (pub.scope === "school") {
      setTargets((prev) => [...prev, { target_type: "school" }]);
    } else if (pub.scope === "faculty") {
      setTargets((prev) => [...prev, { target_type: "faculty", faculty_id: pub.faculty_id }]);
    } else {
      setTargets((prev) => [...prev, { target_type: "department", faculty_id: pub.faculty_id, department_id: pub.department_id }]);
    }
  };

  const updateTarget = (i: number, patch: Partial<TargetDraft>) => {
    setTargets((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };

  const removeTarget = (i: number) => {
    setTargets((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pub) return;
    if (title.trim().length < 4) { toast.error("Title must be at least 4 characters"); return; }
    if (body.trim().length < 10) { toast.error("Body must be at least 10 characters"); return; }
    if (targets.length === 0) { toast.error("Pick at least one target audience"); return; }

    setBusy(true);
    try {
      const { data: memo, error: memoErr } = await supabase.from("memos").insert({
        publisher_id: pub.id,
        school_id: pub.school_id,
        title: title.trim(),
        body: body.trim(),
        urgency,
      }).select().single();
      if (memoErr) throw memoErr;

      const targetRows = targets.map((t) => ({
        memo_id: memo.id,
        target_type: t.target_type,
        school_id: pub.school_id,
        faculty_id: t.faculty_id ?? null,
        department_id: t.department_id ?? null,
        level: t.level ?? null,
      }));
      const { error: tErr } = await supabase.from("memo_targets").insert(targetRows);
      if (tErr) throw tErr;

      toast.success("Memo published");
      navigate(`/memos/${memo.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish memo");
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const allowedTypes: TargetDraft["target_type"][] =
    pub!.scope === "school" ? ["school", "faculty", "department", "level"] :
    pub!.scope === "faculty" ? ["faculty", "department", "level"] :
    ["department", "level"];

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:block"><Navbar /></div>
      <header className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="h-12 px-2 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}
                  className="h-10 w-10 rounded-full" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pt-5 pb-32 lg:pt-[88px] lg:pb-12">
        <div className="flex items-start gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">New memo</h1>
            <p className="text-sm text-muted-foreground mt-1">Posted as an official notice to your audience.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
                   placeholder="e.g. Mid-semester break dates updated"
                   className="h-12 rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={10000}
                      placeholder="Full memo text. Markdown supported."
                      className="rounded-xl resize-none text-[15px] leading-relaxed" />
            <p className="text-[11px] text-muted-foreground">{body.length}/10000</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Urgency</Label>
            <div className="grid grid-cols-3 gap-2">
              {URGENCIES.map((u) => {
                const Icon = u.icon;
                const active = urgency === u.value;
                return (
                  <button key={u.value} type="button" onClick={() => setUrgency(u.value)}
                          className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${
                            active ? "bg-primary/10 border-primary/40 text-primary"
                                   : "bg-card border-border/40 text-foreground hover:bg-muted/40"
                          }`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-semibold">{u.label}</span>
                  </button>
                );
              })}
            </div>
            {urgency !== "general" && (
              <p className="text-[11px] text-muted-foreground">
                {urgency === "urgent" ? "Pinned to feeds and pushed immediately." : "Highlighted and pushed."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Audience</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addTarget}
                      className="text-xs font-semibold text-primary hover:bg-primary/10">
                <Plus className="h-3.5 w-3.5 mr-1" />Add target
              </Button>
            </div>

            {targets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Pick at least one — you can target your whole school, a faculty, a department, or a level.
              </p>
            )}

            <div className="space-y-2">
              {targets.map((t, i) => (
                <div key={i} className="rounded-xl border border-border/40 bg-card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Select value={t.target_type} onValueChange={(v) => updateTarget(i, { target_type: v as any })}>
                      <SelectTrigger className="h-9 rounded-lg flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allowedTypes.map((tt) => <SelectItem key={tt} value={tt}>{labelFor(tt)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon"
                            onClick={() => removeTarget(i)} className="h-9 w-9 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {t.target_type === "faculty" && (
                    <Select value={t.faculty_id || ""} onValueChange={(v) => updateTarget(i, { faculty_id: v })}
                            disabled={pub!.scope !== "school"}>
                      <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Pick faculty" /></SelectTrigger>
                      <SelectContent>{faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}

                  {t.target_type === "department" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={t.faculty_id || ""} onValueChange={(v) => updateTarget(i, { faculty_id: v, department_id: null })}
                              disabled={pub!.scope !== "school"}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Faculty" /></SelectTrigger>
                        <SelectContent>{faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={t.department_id || ""} onValueChange={(v) => updateTarget(i, { department_id: v })}
                              disabled={!t.faculty_id || pub!.scope === "department"}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Department" /></SelectTrigger>
                        <SelectContent>
                          {departments.filter((d: any) => d.faculty_id === t.faculty_id)
                            .map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {t.target_type === "level" && (
                    <Select value={String(t.level ?? "")} onValueChange={(v) => updateTarget(i, { level: Number(v) })}>
                      <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Level" /></SelectTrigger>
                      <SelectContent>
                        {[100,200,300,400,500,600].map((l) => <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={busy}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish memo"}
          </Button>
        </form>
      </div>
      <BottomNav />
    </div>
  );
};

const labelFor = (t: string) =>
  t === "school" ? "Whole school" :
  t === "faculty" ? "Faculty" :
  t === "department" ? "Department" : "Level";

export default CreateMemo;
