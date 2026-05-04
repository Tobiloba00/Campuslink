import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, Loader2, LogOut, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const PendingApproval = () => {
  const navigate = useNavigate();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: any = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data } = await supabase
        .from("publisher_applications")
        .select("*, schools:school_id (name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        // No application — bounce to feed
        navigate("/feed");
        return;
      }

      // Approved already? send to memo composer
      if (data.status === "approved") {
        toast.success("You're verified — let's post your first memo");
        navigate("/memos/new");
        return;
      }

      setApp(data);
      setLoading(false);

      // Realtime: when admin updates the status, react instantly
      channel = supabase
        .channel(`pubapp-${data.id}`)
        .on("postgres_changes",
            { event: "UPDATE", schema: "public", table: "publisher_applications",
              filter: `id=eq.${data.id}` },
            (payload) => {
              const next = payload.new as any;
              setApp((prev: any) => ({ ...prev, ...next }));
              if (next.status === "approved") {
                toast.success("Approved! Welcome aboard 🎉");
                setTimeout(() => navigate("/memos/new"), 1500);
              }
            })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const status = app?.status as "pending" | "approved" | "rejected";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className={`rounded-3xl bg-card border p-8 text-center ${
          status === "rejected" ? "border-red-500/30" : "border-border/50 shadow-sm"
        }`}>
          {/* Status icon */}
          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
            status === "rejected" ? "bg-red-500/10 text-red-600" :
            status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
            "bg-amber-500/10 text-amber-600"
          }`}>
            {status === "rejected" ? <XCircle className="h-8 w-8" /> :
             status === "approved" ? <CheckCircle2 className="h-8 w-8" /> :
             <Clock className="h-8 w-8" />}
          </div>

          <h1 className="text-[24px] font-extrabold tracking-tight mb-2">
            {status === "rejected" ? "Application not approved" :
             status === "approved" ? "You're approved!" :
             "Application under review"}
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {status === "rejected" ? (
              app.rejection_reason || "Your application was not approved at this time."
            ) : status === "approved" ? (
              "Hold on — taking you to the memo composer…"
            ) : (
              "Thanks for applying. A CampusLink admin will review your application soon. You'll get a notification the moment it's decided."
            )}
          </p>

          {/* Application details */}
          {app && (
            <div className="rounded-2xl bg-muted/40 border border-border/40 p-4 text-left text-xs space-y-1.5 mb-6">
              <DetailRow label="Organisation">
                {app.schools?.name || "—"}
              </DetailRow>
              <DetailRow label="Role">
                {app.requested_role === "student_union" ? "Student Union" : "School Admin"}
              </DetailRow>
              <DetailRow label="Scope">
                {app.requested_scope === "school" ? "Whole school" :
                 app.requested_scope === "faculty" ? "Faculty" : "Department"}
              </DetailRow>
              <DetailRow label="Submitted">
                {format(new Date(app.created_at), "PPP")}
              </DetailRow>
              <DetailRow label="Status">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  status === "rejected" ? "bg-red-500/10 text-red-600" :
                  status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                  "bg-amber-500/10 text-amber-600"
                }`}>{status}</span>
              </DetailRow>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {status !== "approved" && (
              <Button onClick={() => navigate("/feed")} variant="outline"
                      className="w-full rounded-xl h-11 font-semibold">
                Browse the app meanwhile
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            )}
            <Button onClick={signOut} variant="ghost"
                    className="w-full rounded-xl h-11 text-sm text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4 mr-1.5" />Sign out
            </Button>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70 mt-4 leading-relaxed">
          Need help? Contact a CampusLink admin or check back later.
        </p>
      </div>
    </div>
  );
};

const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground font-medium">{label}</span>
    <span className="font-semibold text-right truncate">{children}</span>
  </div>
);

export default PendingApproval;
