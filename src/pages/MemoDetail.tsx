import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft, AlertCircle, AlertTriangle, Megaphone, ShieldCheck, Sparkles,
  Clock, Heart, Send, Flag, Loader2, MessageSquare, ThumbsUp, CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type Memo = any;
type Discussion = any;
type Reply = any;

const URG = {
  urgent:    { icon: AlertCircle,    color: "text-red-600",   bg: "bg-red-500/10",   border: "border-red-500/30",   label: "URGENT"    },
  important: { icon: AlertTriangle,  color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "IMPORTANT" },
  general:   { icon: Megaphone,      color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/20",   label: "GENERAL"   },
};

const MemoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [pub, setPub] = useState<any>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [loading, setLoading] = useState(true);
  const [explainOpen, setExplainOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [newQ, setNewQ] = useState("");
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUser(user);

      const { data: m, error } = await supabase.from("memos").select("*").eq("id", id).single();
      if (error || !m) { navigate("/not-found", { replace: true }); return; }
      setMemo(m);

      const { data: p } = await supabase.from("publishers")
        .select("id, display_name, role, scope, verified_at, user:user_id (name, profile_picture)")
        .eq("id", m.publisher_id).single();
      setPub(p);

      const { data: ds } = await supabase.from("memo_discussions")
        .select("*, profiles:user_id (name, profile_picture)")
        .eq("memo_id", id).order("created_at", { ascending: false });
      setDiscussions(ds || []);

      if (ds && ds.length > 0) {
        const { data: rs } = await supabase.from("memo_replies")
          .select("*, profiles:user_id (name, profile_picture)")
          .in("discussion_id", ds.map((d) => d.id))
          .order("helpful_count", { ascending: false });
        const grouped: Record<string, Reply[]> = {};
        (rs || []).forEach((r: any) => {
          if (!grouped[r.discussion_id]) grouped[r.discussion_id] = [];
          grouped[r.discussion_id].push(r);
        });
        setReplies(grouped);
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  const askQuestion = async () => {
    if (!newQ.trim() || !user || !id) return;
    const { error, data } = await supabase.from("memo_discussions").insert({
      memo_id: id, user_id: user.id, question: newQ.trim(),
    }).select("*, profiles:user_id (name, profile_picture)").single();
    if (error) { toast.error(error.message); return; }
    setDiscussions((prev) => [data, ...prev]);
    setNewQ("");
    toast.success("Question posted");
  };

  const sendReply = async (discId: string) => {
    if (!replyText.trim() || !user) return;
    const { error, data } = await supabase.from("memo_replies").insert({
      discussion_id: discId, user_id: user.id, reply: replyText.trim(),
    }).select("*, profiles:user_id (name, profile_picture)").single();
    if (error) { toast.error(error.message); return; }
    setReplies((prev) => ({ ...prev, [discId]: [...(prev[discId] || []), data] }));
    setReplyText(""); setActiveReply(null);
  };

  const toggleVote = async (replyId: string, discId: string) => {
    if (!user) return;
    // Look up existing vote
    const { data: existing } = await supabase.from("memo_reply_votes")
      .select("id").eq("reply_id", replyId).eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("memo_reply_votes").delete().eq("id", existing.id);
      setReplies((prev) => ({
        ...prev,
        [discId]: prev[discId].map((r) => r.id === replyId
          ? { ...r, helpful_count: Math.max(0, (r.helpful_count || 0) - 1), _voted: false } : r),
      }));
    } else {
      await supabase.from("memo_reply_votes").insert({ reply_id: replyId, user_id: user.id });
      setReplies((prev) => ({
        ...prev,
        [discId]: prev[discId].map((r) => r.id === replyId
          ? { ...r, helpful_count: (r.helpful_count || 0) + 1, _voted: true } : r),
      }));
    }
  };

  const submitReport = async (reason: string) => {
    if (!user || !id) return;
    const { error } = await supabase.from("memo_reports").insert({
      reporter_id: user.id, target_type: "memo", target_id: id, reason,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reported — admins will review");
    setReportOpen(false);
  };

  if (loading || !memo) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const meta = URG[memo.urgency as keyof typeof URG];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:block"><Navbar /></div>
      <header className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="h-12 px-2 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}
                  className="h-10 w-10 rounded-full" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setReportOpen(true)}
                  className="h-10 w-10 rounded-full text-muted-foreground" aria-label="Report">
            <Flag className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 pt-3 pb-32 lg:pt-[88px] lg:pb-12">
        {/* Urgency strip */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider ${meta.color} ${meta.bg} mb-3`}>
          <Icon className="h-3.5 w-3.5" />{meta.label}
        </span>

        <h1 className="text-[26px] font-extrabold tracking-tight leading-tight mb-2">{memo.title}</h1>

        {/* Publisher chip */}
        {pub && (
          <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-border/40">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {(pub.display_name || pub.user?.name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold truncate">
                  {pub.display_name || pub.user?.name}
                </p>
                <ShieldCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {pub.role === "student_union" ? "Student Union" : "School Admin"} ·
                Verified {format(new Date(pub.verified_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        )}

        {/* AI explain CTA */}
        <Button onClick={() => setExplainOpen(true)} variant="outline"
                className="w-full mb-5 rounded-xl h-11 justify-start gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Explain this memo
          {!memo.ai_processed_at && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </Button>

        {/* Body */}
        <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">
          {memo.body}
        </div>

        <p className="text-[11px] text-muted-foreground mt-6 pb-6 border-b border-border/40">
          Posted {formatDistanceToNow(new Date(memo.created_at), { addSuffix: true })}
        </p>

        {/* Discussion */}
        <section className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Questions ({discussions.length})</h2>
          </div>

          <div className="bg-card border border-border/40 rounded-2xl p-3 mb-4">
            <Textarea value={newQ} onChange={(e) => setNewQ(e.target.value)}
                      placeholder="Ask a question about this memo…"
                      rows={2} maxLength={500}
                      className="rounded-lg border-none bg-transparent resize-none focus-visible:ring-0 px-1" />
            <div className="flex justify-end mt-1">
              <Button onClick={askQuestion} size="sm" disabled={!newQ.trim()}
                      className="rounded-full text-xs font-semibold">
                <Send className="h-3 w-3 mr-1.5" />Ask
              </Button>
            </div>
          </div>

          <ul className="space-y-3">
            {discussions.map((d) => (
              <li key={d.id} className="rounded-2xl bg-card border border-border/40 p-4">
                <div className="flex items-start gap-2.5 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {d.profiles?.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{d.profiles?.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {d.is_resolved && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />Resolved
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed mb-2">{d.question}</p>

                {/* Replies */}
                <div className="space-y-2 pl-3 border-l-2 border-border/30 mt-3">
                  {(replies[d.id] || []).map((r) => (
                    <div key={r.id} className={`rounded-xl p-2.5 ${r.is_publisher_reply ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold">{r.profiles?.name}</p>
                        {r.is_publisher_reply && <ShieldCheck className="h-3 w-3 text-primary" />}
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{r.reply}</p>
                      <button onClick={() => toggleVote(r.id, d.id)}
                              className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                                r._voted ? "text-primary" : "text-muted-foreground hover:text-primary"
                              }`}>
                        <ThumbsUp className={`h-3 w-3 ${r._voted ? "fill-current" : ""}`} />
                        Helpful {r.helpful_count > 0 && `(${r.helpful_count})`}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Inline reply composer */}
                {activeReply === d.id ? (
                  <div className="mt-3 flex gap-2">
                    <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply…" rows={1} maxLength={1000}
                              className="rounded-lg text-sm resize-none flex-1" />
                    <Button onClick={() => sendReply(d.id)} size="sm" disabled={!replyText.trim()}
                            className="rounded-full text-xs font-semibold">Send</Button>
                  </div>
                ) : (
                  <button onClick={() => { setActiveReply(d.id); setReplyText(""); }}
                          className="mt-2 text-xs font-semibold text-muted-foreground hover:text-primary">
                    Reply
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* AI Explain sheet */}
      <Sheet open={explainOpen} onOpenChange={setExplainOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Memo explained
            </SheetTitle>
          </SheetHeader>
          {!memo.ai_processed_at ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Generating — refresh in a few seconds.
            </p>
          ) : (
            <div className="space-y-4 pb-6">
              <ExplainBlock title="Summary" body={memo.ai_summary} />
              <ExplainBlock title="What you need to do" body={memo.ai_required_action} icon={Heart} />
              <ExplainBlock title="Deadline" body={memo.ai_deadline ? format(new Date(memo.ai_deadline), "PPP") : null} icon={Clock} />
              <ExplainBlock title="If ignored" body={memo.ai_consequences} icon={AlertCircle} />
              <p className="text-[11px] text-muted-foreground/80 pt-2 border-t border-border/40 leading-relaxed">
                AI summary — verify against the original memo above.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Report sheet */}
      <Sheet open={reportOpen} onOpenChange={setReportOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left mb-4">
            <SheetTitle>Report this memo</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-6">
            {(["spam", "misinformation", "impersonation", "harassment", "other"] as const).map((r) => (
              <button key={r} onClick={() => submitReport(r)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/40 hover:bg-muted/40 transition-colors text-left">
                <span className="text-sm font-medium capitalize">{r}</span>
                <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  );
};

const ExplainBlock = ({ title, body, icon: Icon }: { title: string; body: string | null; icon?: any }) => {
  if (!body) return null;
  return (
    <div className="rounded-xl bg-card border border-border/40 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}
        {title}
      </p>
      <p className="text-sm leading-relaxed">{body}</p>
    </div>
  );
};

export default MemoDetail;
