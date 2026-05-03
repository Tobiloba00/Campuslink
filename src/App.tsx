import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { Logo } from "@/components/Logo";

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
const MyTasks = lazy(() => import("./pages/MyTasks"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Memos = lazy(() => import("./pages/Memos"));
const MemoDetail = lazy(() => import("./pages/MemoDetail"));
const CreateMemo = lazy(() => import("./pages/CreateMemo"));
const ApplyPublisher = lazy(() => import("./pages/ApplyPublisher"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Logo size={52} className="animate-pulse text-primary" />
      <p className="text-xs text-muted-foreground font-medium tracking-wide">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <PageTransition>
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
              <Route path="/my-tasks" element={<MyTasks />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/post/:id" element={<PostDetail />} />
              <Route path="/memos" element={<Memos />} />
              <Route path="/memos/new" element={<CreateMemo />} />
              <Route path="/memos/:id" element={<MemoDetail />} />
              <Route path="/apply-publisher" element={<ApplyPublisher />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
        </Suspense>
        <PWAInstallPrompt />
        <UpdatePrompt />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
