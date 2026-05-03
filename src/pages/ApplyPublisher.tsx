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
import { ArrowLeft, ShieldCheck, Loader2, Mail, ImageIcon, Link as LinkIcon, User } from "lucide-react";

type School = { id: string; name: string };
type Faculty = { id: string; name: string };
type Dept = { id: string; name: string };

const ApplyPublisher = () => {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState<"student_union" | "school_admin">("student_union");
  const [scope, setScope] = useState<"school" | "faculty" | "department">("school");
  const [proofEmail, setProofEmail] = useState("");
  const [proofWa, setProofWa] = useState("");
  const [proofRef, setProofRef] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingApp, setPendingApp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const [{ data: existing }, { data: ss }] = await Promise.all([
        supabase.from("publisher_applications").select("*")
          .eq("user_id", user.id).eq("status", "pending").maybeSingle(),
        supabase.from("schools").select("id, name").order("name"),
      ]);
      setPendingApp(existing);
      setSchools(ss || []);
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!schoolId) { setFaculties([]); setFacultyId(""); return; }
    supabase.from("faculties").select("id, name").eq("school_id", schoolId).order("name")
      .then(({ data }) => setFaculties(data || []));
  }, [schoolId]);

  useEffect(() => {
    if (!facultyId) { setDepartments([]); setDepartmentId(""); return; }
    supabase.from("departments").select("id, name").eq("faculty_id", facultyId).order("name")
      .then(({ data }) => setDepartments(data || []));
  }, [facultyId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) { toast.error("Pick your school"); return; }
    if (scope === "faculty" && !facultyId) { toast.error("Pick a faculty"); return; }
    if (scope === "department" && (!facultyId || !departmentId)) {
      toast.error("Pick a faculty and department"); return;
    }
    if (!proofEmail && !proofWa && !proofRef) {
      toast.error("Provide at least one piece of proof"); return;
    }

    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("publisher_applications").insert({
        user_id: user.id,
        school_id: schoolId,
        requested_role: role,
        requested_scope: scope,
        faculty_id: scope !== "school" ? facultyId : null,
        department_id: scope === "department" ? departmentId : null,
        proof_email: proofEmail || null,
        proof_whatsapp_link: proofWa || null,
        proof_reference_name: proofRef || null,
        applicant_notes: notes || null,
      });
      if (error) throw error;

      toast.success("Application submitted — we'll review it shortly");
      navigate("/profile");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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

      <div className="max-w-xl mx-auto px-5 pt-6 pb-32 lg:pt-[88px] lg:pb-12">
        <div className="flex items-start gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">Become a Publisher</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verified bodies (SUG, school admin) can post official memos to students.
            </p>
          </div>
        </div>

        {pendingApp ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
            <p className="font-bold text-sm mb-1">Application under review</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We received your application and a CampusLink admin will review it. You'll get a
              notification when there's an update.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">School</Label>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Pick your school" /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {schools.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No schools registered yet. Ask the platform admin to add one.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student_union">Student Union</SelectItem>
                    <SelectItem value="school_admin">School Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Scope</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">Whole school</SelectItem>
                    <SelectItem value="faculty">A faculty</SelectItem>
                    <SelectItem value="department">A department</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {scope !== "school" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Faculty</Label>
                <Select value={facultyId} onValueChange={setFacultyId} disabled={!schoolId}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Pick a faculty" /></SelectTrigger>
                  <SelectContent>
                    {faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "department" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId} disabled={!facultyId}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Pick a department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Proof of role (at least one)
              </p>
              <div className="space-y-2.5">
                <FieldRow icon={Mail} label="School email">
                  <Input value={proofEmail} onChange={(e) => setProofEmail(e.target.value)}
                         placeholder="you@school.edu.ng" type="email" className="h-11 rounded-xl" />
                </FieldRow>
                <FieldRow icon={LinkIcon} label="WhatsApp group link">
                  <Input value={proofWa} onChange={(e) => setProofWa(e.target.value)}
                         placeholder="https://chat.whatsapp.com/..." className="h-11 rounded-xl" />
                </FieldRow>
                <FieldRow icon={User} label="Known executive name">
                  <Input value={proofRef} onChange={(e) => setProofRef(e.target.value)}
                         placeholder="e.g. Tola Adegbite, Faculty Rep" className="h-11 rounded-xl" />
                </FieldRow>
                <FieldRow icon={ImageIcon} label="Notes (optional)">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="Anything else admin should know"
                            rows={2} className="rounded-xl resize-none" />
                </FieldRow>
              </div>
            </div>

            <Button type="submit" disabled={busy}
                    className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit application"}
            </Button>
          </form>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

const FieldRow = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5">
    <Icon className="h-4 w-4 text-muted-foreground mt-3 flex-shrink-0" />
    <div className="flex-1">
      <Label className="text-xs font-medium mb-1 block">{label}</Label>
      {children}
    </div>
  </div>
);

export default ApplyPublisher;
