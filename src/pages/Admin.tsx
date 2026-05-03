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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

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
      <div className="container mx-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+7rem)] pb-24 lg:pb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Admin Dashboard</h1>

        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="overflow-x-auto scrollbar-hide flex-wrap h-auto">
            <TabsTrigger value="applications" className="gap-2"><ShieldCheck className="h-4 w-4" />Applications</TabsTrigger>
            <TabsTrigger value="publishers" className="gap-2"><Megaphone className="h-4 w-4" />Publishers</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><Flag className="h-4 w-4" />Reports</TabsTrigger>
            <TabsTrigger value="schools" className="gap-2"><Building2 className="h-4 w-4" />Schools</TabsTrigger>
            <TabsTrigger value="posts" className="gap-2"><FileText className="h-4 w-4" />Posts</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Users</TabsTrigger>
          </TabsList>

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
