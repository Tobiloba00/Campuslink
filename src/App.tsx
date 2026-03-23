import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Eagerly loaded (landing + auth — fast first paint)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy loaded (code-split for performance)
const Feed = lazy(() => import("./pages/Feed"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const EditPost = lazy(() => import("./pages/EditPost"));
const Profile = lazy(() => import("./pages/Profile"));
const Messages = lazy(() => import("./pages/Messages"));
const Admin = lazy(() => import("./pages/Admin"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const UserSearch = lazy(() => import("./pages/UserSearch"));
const RateUser = lazy(() => import("./pages/RateUser"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <div className="mesh-background" />
      <div className="glow-sphere bg-primary w-[500px] h-[500px] -top-20 -left-20" />
      <div className="glow-sphere bg-accent w-[400px] h-[400px] bottom-0 -right-20" />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/create-post" element={<CreatePost />} />
            <Route path="/edit-post/:id" element={<EditPost />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/users" element={<UserSearch />} />
            <Route path="/user-search" element={<UserSearch />} />
            <Route path="/rate-user/:userId" element={<RateUser />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/post/:id" element={<PostDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
