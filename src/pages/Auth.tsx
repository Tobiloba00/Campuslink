import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, BookOpen, MessageSquare, Star, Eye, EyeOff, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

type AuthStep = 'form' | 'verify';

const OTP_LENGTH = 6;

const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>('form');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up with password, then Supabase sends confirmation email
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        // Move to OTP verification step
        setStep('verify');
        setResendCooldown(60);
        toast.success("Verification code sent to your email!");
      } else {
        // Regular sign in with password
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newValues = [...otpValues];
    newValues[index] = digit;
    setOtpValues(newValues);

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (digit && index === OTP_LENGTH - 1) {
      const code = newValues.join('');
      if (code.length === OTP_LENGTH) {
        verifyOTP(code);
      }
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const newValues = [...otpValues];
    for (let i = 0; i < pasted.length; i++) {
      newValues[i] = pasted[i];
    }
    setOtpValues(newValues);

    // Focus last filled or next empty
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[focusIdx]?.focus();

    // Auto-submit if complete
    if (pasted.length === OTP_LENGTH) {
      verifyOTP(pasted);
    }
  };

  const verifyOTP = async (code: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });
      if (error) throw error;
      toast.success("Email verified! Welcome to CampusLink!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code");
      setOtpValues(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setResendCooldown(60);
      setOtpValues(Array(OTP_LENGTH).fill(''));
      toast.success("New code sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: BookOpen, text: 'Get help with assignments from peers who aced the same courses' },
    { icon: MessageSquare, text: 'Real-time messaging with typing indicators and AI suggestions' },
    { icon: Star, text: 'Build your campus reputation and climb the leaderboard' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Social Proof (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05)_0%,transparent_50%)]" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <button onClick={() => navigate('/')} className="group">
              <Logo size={36} showText className="text-white" textClassName="text-lg text-white" />
            </button>
          </div>

          <div className="space-y-10">
            <div>
              <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
                Where students help students succeed.
              </h2>
              <p className="text-white/70 text-lg leading-relaxed max-w-md">
                Join a community built on collaboration, trust, and mutual growth.
              </p>
            </div>

            <div className="space-y-5">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 flex-shrink-0 group-hover:bg-white/15 transition-colors">
                    <feature.icon className="h-5 w-5 text-white/90" />
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed pt-2">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-white/10">
            <p className="text-white/50 text-xs">
              Powered by <span className="text-white/70 font-semibold">Omniai</span> &middot; AI-driven campus networking
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 relative">
        <div className="mesh-background" />

        {/* Mobile logo */}
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 lg:hidden">
          <Logo size={32} showText textClassName="text-sm" />
        </button>

        <div className="w-full max-w-sm relative z-10 animate-hero">

          {step === 'verify' ? (
            /* ─── OTP Verification Screen ─── */
            <div className="text-center">
              {/* Back button */}
              <button
                onClick={() => { setStep('form'); setOtpValues(Array(OTP_LENGTH).fill('')); }}
                className="absolute top-6 right-6 lg:top-0 lg:right-0 lg:relative lg:mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                Check your email
              </h1>
              <p className="text-muted-foreground text-sm mb-1">
                We sent a verification code to
              </p>
              <p className="text-sm font-semibold mb-8">{email}</p>

              {/* OTP Input */}
              <div className="flex justify-center gap-2.5 sm:gap-3 mb-6">
                {otpValues.map((val, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={val}
                    onChange={e => handleOTPChange(i, e.target.value)}
                    onKeyDown={e => handleOTPKeyDown(i, e)}
                    onPaste={i === 0 ? handleOTPPaste : undefined}
                    className={`
                      w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold
                      rounded-xl border-2 bg-muted/30 outline-none
                      transition-all duration-200
                      ${val
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border/50 text-foreground'
                      }
                      focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-background
                    `}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              {/* Loading state */}
              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                  <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Verifying...
                </div>
              )}

              {/* Verified badge hint */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60 mb-6">
                <ShieldCheck className="h-3.5 w-3.5" />
                Enter the 6-digit code from your email
              </div>

              {/* Resend */}
              <div className="text-sm text-muted-foreground">
                Didn't get the code?{' '}
                {resendCooldown > 0 ? (
                  <span className="text-muted-foreground/60">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-primary font-semibold hover:text-primary/80 transition-colors"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ─── Sign In / Sign Up Form ─── */
            <>
              <div className="text-center mb-8">
                <div className="lg:hidden flex justify-center mb-5">
                  <Logo size={56} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                  {isSignUp ? "Create your account" : "Welcome back"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {isSignUp
                    ? "Start connecting with your campus community"
                    : "Sign in to continue where you left off"}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@student.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-gradient-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold text-sm"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{isSignUp ? "Creating account..." : "Signing in..."}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{isSignUp ? "Create account" : "Sign in"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
                </div>
              </div>

              {/* Toggle */}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full h-12 rounded-xl border border-border/50 text-sm font-medium hover:bg-muted/50 transition-all active:scale-[0.98]"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>

              <p className="text-center text-[11px] text-muted-foreground/60 mt-6 leading-relaxed">
                By continuing, you agree to CampusLink's Terms of Service and Privacy Policy.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
