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
  ArrowLeft, ArrowRight, ShieldCheck, Loader2, Mail, Link as LinkIcon, User as UserIcon,
  CheckCircle2, ClipboardCheck, Eye, Sparkles, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SchoolPicker, type SchoolPickerValue } from "@/components/SchoolPicker";

type School = { id: string; name: string };
type Faculty = { id: string; name: string };
type Dept = { id: string; name: string };
type Step = 1 | 2 | 3;

const ApplyPublisher = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // Lookups
  const [schools, setSchools] = useState<School[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);

  // Form fields
  const [school, setSchool] = useState<SchoolPickerValue>({ id: "", name: "" });
  const [role, setRole] = useState<"student_union" | "school_admin" | "">("");
  const [scope, setScope] = useState<"school" | "faculty" | "department" | "">("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // Faculty/department selection only works for schools that already exist
  // (because their faculties/departments need to exist too).
  const isProposedSchool = !school.id && !!school.name.trim();
  // Whenever the user switches to a proposed school, force scope back to whole-school
  useEffect(() => {
    if (isProposedSchool && scope !== "school" && scope !== "") {
      setScope("school");
      setFacultyId("");
      setDepartmentId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProposedSchool]);
  const [proofEmail, setProofEmail] = useState("");
  const [proofWa, setProofWa] = useState("");
  const [proofRef, setProofRef] = useState("");
  const [notes, setNotes] = useState("");

  // Are we already in a flow we shouldn't be?
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const [{ data: pending }, { data: ss }] = await Promise.all([
        supabase.from("publisher_applications").select("id, status")
          .eq("user_id", user.id).eq("status", "pending").maybeSingle(),
        supabase.from("schools").select("id, name").order("name"),
      ]);
      if (pending) { navigate("/pending-approval", { replace: true }); return; }
      setSchools(ss || []);
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!school.id) { setFaculties([]); return; }
    supabase.from("faculties").select("id, name").eq("school_id", school.id).order("name")
      .then(({ data }) => setFaculties(data || []));
  }, [school.id]);
  useEffect(() => {
    if (!facultyId) { setDepartments([]); return; }
    supabase.from("departments").select("id, name").eq("faculty_id", facultyId).order("name")
      .then(({ data }) => setDepartments(data || []));
  }, [facultyId]);

  const validateStep1 = (): string | null => {
    if (!school.id && !school.name.trim()) return "Type or pick the school you represent";
    if (school.name.trim().length < 2) return "School name is too short";
    if (!role) return "Pick a role";
    if (!scope) return "Pick a scope";
    if (scope === "faculty" && !facultyId) return "Pick a faculty";
    if (scope === "department" && (!facultyId || !departmentId)) return "Pick a faculty and department";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!proofEmail.trim() && !proofWa.trim() && !proofRef.trim()) {
      return "Provide at least one piece of proof";
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep1();
    if (err) { toast.error(err); return; }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    const err = validateStep2();
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("publisher_applications").insert({
        user_id: user.id,
        // Either send the FK or the proposed name — the DB CHECK enforces
        // that at least one is set.
        school_id: school.id || null,
        proposed_school_name: school.id ? null : school.name.trim(),
        requested_role: role,
        requested_scope: scope,
        faculty_id: scope !== "school" ? facultyId : null,
        department_id: scope === "department" ? departmentId : null,
        proof_email: proofEmail.trim() || null,
        proof_whatsapp_link: proofWa.trim() || null,
        proof_reference_name: proofRef.trim() || null,
        applicant_notes: notes.trim() || null,
      });
      if (error) throw error;
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="hidden lg:block"><Navbar /></div>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="h-12 px-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate(-1) : setStep((s) => Math.max(1, s - 1) as Step)}
                  className="h-10 w-10 rounded-full" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[17px] font-bold">Become a Publisher</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-5 pt-4 lg:pt-[100px] pb-32 lg:pb-12">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 lg:gap-10">
          {/* ─── Hero column (desktop only) ─── */}
          <aside className="hidden lg:block">
            <HeroColumn />
          </aside>

          {/* ─── Wizard column ─── */}
          <main>
            {step !== 3 && (
              <>
                <ProgressHeader step={step} total={2} />

                <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-5 sm:p-7 space-y-6">
                  {step === 1 && (
                    <Step1
                      school={school}
                      setSchool={(v) => { setSchool(v); setFacultyId(""); setDepartmentId(""); }}
                      role={role} setRole={setRole}
                      scope={scope} setScope={(v) => { setScope(v); setFacultyId(""); setDepartmentId(""); }}
                      facultyId={facultyId} setFacultyId={setFacultyId}
                      departmentId={departmentId} setDepartmentId={setDepartmentId}
                      schools={schools} faculties={faculties} departments={departments}
                      isProposedSchool={isProposedSchool}
                    />
                  )}
                  {step === 2 && (
                    <Step2
                      proofEmail={proofEmail} setProofEmail={setProofEmail}
                      proofWa={proofWa} setProofWa={setProofWa}
                      proofRef={proofRef} setProofRef={setProofRef}
                      notes={notes} setNotes={setNotes}
                    />
                  )}
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-3 mt-5">
                  {step === 1 ? (
                    <>
                      <Button variant="outline" onClick={() => navigate(-1)}
                              className="flex-1 sm:flex-none rounded-xl h-12 font-semibold">
                        Cancel
                      </Button>
                      <Button onClick={goNext}
                              className="flex-1 sm:ml-auto sm:flex-initial rounded-xl h-12 px-7 bg-primary text-primary-foreground font-semibold">
                        Continue<ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setStep(1)}
                              className="flex-1 sm:flex-none rounded-xl h-12 font-semibold">
                        <ArrowLeft className="h-4 w-4 mr-1.5" />Back
                      </Button>
                      <Button onClick={submit} disabled={busy}
                              className="flex-1 sm:ml-auto sm:flex-initial rounded-xl h-12 px-7 bg-primary text-primary-foreground font-semibold">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <>Submit Application<ArrowRight className="h-4 w-4 ml-1.5" /></>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {step === 3 && <SuccessPanel onHome={() => navigate("/pending-approval")} />}
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

/* ─── Hero column (desktop) ─── */
const HeroColumn = () => (
  <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-7 sticky top-[100px]">
    <span className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-5">
      <CheckCircle2 className="h-3.5 w-3.5" />Become a Publisher
    </span>
    <h1 className="text-[28px] font-extrabold tracking-tight leading-[1.1] mb-3">
      Become an<br />Official Publisher
    </h1>
    <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-[300px]">
      Post verified memos and important announcements to reach students in your university.
    </p>
    <ApplyArtwork />

    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        How it works
      </p>
      <ol className="space-y-3.5">
        <HowStep n={1} title="Submit your application"
                body="Fill in your details and provide proof of your role." />
        <HowStep n={2} title="Admin reviews your proof"
                body="Our team will verify your information carefully." />
        <HowStep n={3} title="Get verified"
                body="Once approved, you get a verified badge." />
        <HowStep n={4} title="Start posting memos"
                body="Share official updates with students." />
      </ol>
    </div>

    <div className="mt-6 pt-5 border-t border-border/40 flex items-start gap-2 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
      <span className="leading-relaxed">
        Your information is secure and used only for verification.
      </span>
    </div>
  </div>
);

const HowStep = ({ n, title, body }: { n: number; title: string; body: string }) => (
  <li className="flex gap-3">
    <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
      {n}
    </span>
    <div>
      <p className="text-sm font-semibold leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{body}</p>
    </div>
  </li>
);

const ApplyArtwork = () => (
  <svg width="160" height="120" viewBox="0 0 160 120" className="mx-auto" fill="none" aria-hidden="true">
    <ellipse cx="80" cy="65" rx="60" ry="48" fill="hsl(var(--primary) / 0.10)" />
    <path d="M52 50 H106 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 H72 l-10 10 v-10 H52 a8 8 0 0 1 -8 -8 V58 a8 8 0 0 1 8 -8 z"
          fill="white" stroke="hsl(var(--primary))" strokeWidth="2" />
    <circle cx="93" cy="54" r="14" fill="hsl(var(--primary))" />
    <path d="M88 54 l3.5 3.5 L99 50" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M132 30 L134 35 L139 37 L134 39 L132 44 L130 39 L125 37 L130 35 Z"
          fill="hsl(var(--primary) / 0.5)" />
    <circle cx="28" cy="38" r="2" fill="hsl(var(--primary) / 0.5)" />
    <circle cx="40" cy="20" r="2.5" fill="hsl(var(--primary) / 0.4)" />
  </svg>
);

/* ─── Progress header ─── */
const ProgressHeader = ({ step, total }: { step: Step; total: number }) => (
  <div className="mb-5">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-semibold text-muted-foreground">Step {step} of {total}</span>
      <span className="text-xs font-medium text-muted-foreground/70">
        {step === 1 ? "Tell us who you are" : "Verify your role"}
      </span>
    </div>
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-primary transition-all"
           style={{ width: `${(step / total) * 100}%` }} />
    </div>
  </div>
);

/* ─── Step 1: School + Role + Scope ─── */
const Step1 = ({
  school, setSchool, role, setRole, scope, setScope,
  facultyId, setFacultyId, departmentId, setDepartmentId,
  schools, faculties, departments, isProposedSchool,
}: any) => (
  <>
    <SectionHeader index={1} title="School & Role" />

    <div className="space-y-4">
      <FormField label="School" hint="Type your school's name. If it's not in the list yet, you can still proceed — we'll add it once you're verified.">
        <SchoolPicker value={school} onChange={setSchool} schools={schools} />
      </FormField>

      <FormField label="Role">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select your role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="student_union">Student Union</SelectItem>
            <SelectItem value="school_admin">School Admin</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label="Scope"
        hint={isProposedSchool
          ? "Locked to whole-school for new schools — pick faculty / department after your school is verified."
          : "Scope determines who will see your memos."}
      >
        <Select
          value={scope}
          onValueChange={setScope}
          disabled={isProposedSchool}
        >
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select scope" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="school">Whole school</SelectItem>
            <SelectItem value="faculty" disabled={isProposedSchool}>A faculty</SelectItem>
            <SelectItem value="department" disabled={isProposedSchool}>A department</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {scope && scope !== "school" && !isProposedSchool && (
        <FormField label="Faculty">
          <Select value={facultyId} onValueChange={setFacultyId} disabled={!school.id}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pick a faculty" /></SelectTrigger>
            <SelectContent>
              {faculties.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
      )}

      {scope === "department" && !isProposedSchool && (
        <FormField label="Department">
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={!facultyId}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pick a department" /></SelectTrigger>
            <SelectContent>
              {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
      )}
    </div>
  </>
);

/* ─── Step 2: Proof + Notes ─── */
const Step2 = ({
  proofEmail, setProofEmail, proofWa, setProofWa, proofRef, setProofRef, notes, setNotes,
}: any) => (
  <>
    <SectionHeader index={2} title="Proof of Role" subtitle="(at least one)" />

    <div className="grid sm:grid-cols-3 gap-3">
      <ProofCard
        icon={Mail} title="School Email"
        active={!!proofEmail.trim()}
        hint="Use your official school email address"
      >
        <Input
          value={proofEmail} onChange={(e) => setProofEmail(e.target.value)}
          type="email" placeholder="you@school.edu.ng"
          className="h-10 rounded-lg border-border/40"
        />
      </ProofCard>
      <ProofCard
        icon={LinkIcon} title="WhatsApp Group Link"
        active={!!proofWa.trim()}
        hint="Provide a link to your official WhatsApp group"
      >
        <Input
          value={proofWa} onChange={(e) => setProofWa(e.target.value)}
          placeholder="https://chat.whatsapp.com/…"
          className="h-10 rounded-lg border-border/40"
        />
      </ProofCard>
      <ProofCard
        icon={UserIcon} title="Known Executive"
        active={!!proofRef.trim()}
        hint="Provide the name of a known executive"
      >
        <Input
          value={proofRef} onChange={(e) => setProofRef(e.target.value)}
          placeholder="e.g. Tola Adegbite, Faculty Rep"
          className="h-10 rounded-lg border-border/40"
        />
      </ProofCard>
    </div>

    <div className="pt-2">
      <SectionHeader index={3} title="Additional Information" subtitle="(Optional)" />
      <FormField label="Notes for the admin">
        <Textarea
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else admin should know…"
          rows={3} className="rounded-xl resize-none"
        />
      </FormField>
    </div>
  </>
);

/* ─── Success ─── */
const SuccessPanel = ({ onHome }: { onHome: () => void }) => (
  <div className="bg-card rounded-3xl border border-border/40 shadow-sm p-8 sm:p-10 text-center">
    <div className="relative h-20 w-20 mx-auto mb-5">
      <div className="absolute inset-0 rounded-full bg-emerald-500/15" />
      <div className="absolute inset-2 rounded-full bg-emerald-500 flex items-center justify-center">
        <CheckCircle2 className="h-9 w-9 text-white" strokeWidth={2.4} />
      </div>
    </div>
    <h2 className="text-[26px] font-extrabold tracking-tight mb-2">Application Submitted!</h2>
    <p className="text-sm text-muted-foreground mb-6">Your application has been received successfully.</p>

    <div className="text-left bg-muted/40 rounded-2xl p-4 max-w-sm mx-auto">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
        What happens next?
      </p>
      <ul className="space-y-2 text-sm">
        <NextStep>Our team will review your application</NextStep>
        <NextStep>We may contact you for more info</NextStep>
        <NextStep>You'll be notified once there's an update</NextStep>
      </ul>
    </div>

    <Button onClick={onHome}
            className="mt-6 w-full sm:w-auto rounded-xl h-12 px-8 bg-primary text-primary-foreground font-semibold">
      Back to Home
    </Button>
  </div>
);

const NextStep = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2">
    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
    <span>{children}</span>
  </li>
);

/* ─── Helpers ─── */
const SectionHeader = ({ index, title, subtitle }: { index: number; title: string; subtitle?: string }) => (
  <div className="flex items-baseline gap-2 mb-3">
    <span className="text-base font-bold">{index}.</span>
    <h2 className="text-base font-bold tracking-tight">{title}</h2>
    {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
  </div>
);

const FormField = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-semibold">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const ProofCard = ({
  icon: Icon, title, hint, active, children,
}: { icon: any; title: string; hint: string; active: boolean; children: React.ReactNode }) => (
  <div className={cn(
    "rounded-2xl border p-3.5 transition-colors",
    active ? "border-primary bg-primary/5" : "border-border/40 bg-card"
  )}>
    <div className="flex items-start gap-2.5 mb-3">
      <div className={cn(
        "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{hint}</p>
      </div>
      {active && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
    </div>
    {children}
  </div>
);

export default ApplyPublisher;
