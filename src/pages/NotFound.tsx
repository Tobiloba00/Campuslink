import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowLeft, Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="mesh-background" />

      {/* Decorative blobs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] pointer-events-none animate-float-delayed" />

      <div className="text-center relative z-10 max-w-lg animate-hero">
        {/* Logo */}
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-primary shadow-2xl shadow-primary/30 mb-8">
          <GraduationCap className="h-8 w-8 text-primary-foreground" />
        </div>

        {/* 404 number */}
        <div className="text-8xl sm:text-9xl font-black text-primary/10 dark:text-primary/15 leading-none tracking-tighter select-none mb-2">
          404
        </div>

        {/* Message */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 -mt-4">
          Page not found
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Looks like this page skipped class today. The link you followed may be broken, or the page may have been removed.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            className="rounded-full px-6 bg-gradient-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            onClick={() => navigate('/feed')}
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Feed
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full px-6 border-border/50 hover:bg-primary/5 transition-all"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
