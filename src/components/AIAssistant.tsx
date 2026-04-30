import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Send,
  Trash2,
  ArrowDown,
  ChevronRight,
  PenLine,
  Star,
  LayoutGrid,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { LogoMark } from '@/components/Logo';

type SuggestedQuestion = {
  text: string;
  icon: typeof PenLine;
};

const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { text: 'How do I create a post?', icon: PenLine },
  { text: 'How does the rating system work?', icon: Star },
  { text: 'What categories can I post in?', icon: LayoutGrid },
  { text: 'How do I message someone?', icon: Send },
  { text: 'Tips for getting more responses?', icon: TrendingUp },
];

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const lastScrollY = useRef(0);
  const { messages, isLoading, sendMessage, clearMessages } = useAIAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: smooth ? 'smooth' : 'instant',
        });
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opening (only when there are existing messages — avoid
  // the iOS keyboard popping over the welcome state).
  useEffect(() => {
    if (isOpen && messages.length > 0 && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen, messages.length]);

  // Hide FAB on scroll (mobile only)
  useEffect(() => {
    if (!isMobile) return;
    const handleScroll = () => {
      const y = window.scrollY;
      setIsVisible(y <= lastScrollY.current || y < 100);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Track scroll position for "scroll to bottom" button
  const handleScrollChange = useCallback(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
    }
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.addEventListener('scroll', handleScrollChange, { passive: true });
      return () => viewport.removeEventListener('scroll', handleScrollChange);
    }
  }, [isOpen, handleScrollChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestion = (question: string) => {
    sendMessage(question);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <>
      {/* FAB Trigger — uses the CampusLink mark instead of an AI sparkle */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed z-40 rounded-full shadow-xl flex items-center justify-center',
          'bg-primary text-white',
          'transition-all duration-300 hover:scale-110 active:scale-95',
          'hover:shadow-primary/40 hover:shadow-2xl',
          isMobile ? 'bottom-[96px] right-4 h-12 w-12' : 'bottom-6 right-6 h-14 w-14',
          isOpen && 'pointer-events-none opacity-0 scale-50',
          !isVisible && isMobile ? 'scale-75 opacity-40' : 'opacity-100'
        )}
        aria-label="Open CampusLink AI assistant"
      >
        <LogoMark size={isMobile ? 22 : 26} className="text-white" />
        {!isOpen && messages.length === 0 && (
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-40" />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Panel */}
      <div
        className={cn(
          'fixed z-50 flex flex-col bg-background shadow-2xl transition-all duration-300 ease-out overflow-hidden',
          isMobile
            ? 'inset-x-0 bottom-0 rounded-t-3xl max-h-[88dvh] h-[88dvh]'
            : 'bottom-6 right-6 w-[420px] h-[620px] rounded-3xl border border-border/40',
          isOpen
            ? 'translate-y-0 opacity-100'
            : isMobile
            ? 'translate-y-full opacity-0 pointer-events-none'
            : 'translate-y-4 opacity-0 pointer-events-none scale-95'
        )}
      >
        {/* Drag handle (mobile only) */}
        {isMobile && (
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-9 h-1 bg-muted-foreground/25 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <LogoMark size={26} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[17px] font-bold tracking-tight leading-tight truncate">
                CampusLink AI
              </h3>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">
                {isLoading ? 'Thinking…' : 'Your campus assistant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl bg-muted/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={clearMessages}
                title="Clear chat"
                aria-label="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl bg-muted/60 hover:bg-muted text-foreground"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 relative overflow-hidden">
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="px-4 sm:px-5 pt-2 pb-4">
              {messages.length === 0 ? (
                <div className="space-y-6">
                  {/* Welcome */}
                  <div className="flex flex-col items-center text-center pt-6">
                    <ChatArtwork />
                    <h3 className="font-extrabold text-[22px] tracking-tight mt-5 mb-1.5">
                      Hi there! 👋
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
                      I'm your CampusLink assistant.
                      <br />
                      How can I help you today?
                    </p>
                  </div>

                  {/* Quick questions */}
                  <div>
                    <h4 className="text-[15px] font-bold tracking-tight mb-3">
                      Quick questions
                    </h4>
                    <div className="space-y-2.5">
                      {SUGGESTED_QUESTIONS.map((q, i) => {
                        const Icon = q.icon;
                        return (
                          <button
                            key={i}
                            onClick={() => handleSuggestion(q.text)}
                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-card border border-border/40 hover:border-primary/30 hover:bg-primary/[0.03] transition-all active:scale-[0.99] text-left"
                          >
                            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.8} />
                            </div>
                            <span className="flex-1 text-sm font-medium text-foreground">
                              {q.text}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                          <LogoMark size={16} className="text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md shadow-sm shadow-primary/20'
                            : 'bg-muted/60 border border-border/30 rounded-bl-md'
                        )}
                      >
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        ) : (
                          <div className="ai-markdown prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-pre:my-2 prose-pre:bg-background/50 prose-pre:border prose-pre:border-border/30 prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto prose-code:text-[12px] prose-code:break-all text-foreground">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex justify-start">
                      <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                        <LogoMark size={16} className="text-primary" />
                      </div>
                      <div className="bg-muted/60 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <div
                            className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <div
                            className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Scroll-to-bottom */}
          {showScrollDown && (
            <button
              onClick={() => scrollToBottom()}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-background border border-border/50 shadow-lg flex items-center justify-center hover:bg-muted transition-all"
              aria-label="Scroll to latest message"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Input area */}
        <div
          className="shrink-0 px-3 sm:px-4 pt-3 bg-background/80 backdrop-blur-sm border-t border-border/40"
          style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 12px)` }}
        >
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-card border border-border/50 rounded-full pl-4 pr-2 py-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={isLoading}
                rows={1}
                className={cn(
                  'flex-1 resize-none bg-transparent border-none px-0 py-2 text-[15px]',
                  'placeholder:text-muted-foreground/60 focus:outline-none',
                  'min-h-[28px] max-h-[120px]',
                  'disabled:opacity-50'
                )}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 shrink-0 transition-all disabled:opacity-30 shadow-md shadow-primary/25"
              aria-label="Send"
            >
              <Send className="h-[18px] w-[18px]" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────
   Welcome illustration — overlapping chat bubbles + sparkles
   ──────────────────────────────────────────── */
const ChatArtwork = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    aria-hidden="true"
  >
    {/* Soft back bubble */}
    <ellipse
      cx="48"
      cy="58"
      rx="32"
      ry="30"
      fill="hsl(var(--primary) / 0.12)"
    />

    {/* Front white bubble with shadow */}
    <g filter="url(#chat-shadow)">
      <path
        d="M40 38 H86 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 H66 l-9 9 v-9 H40 a10 10 0 0 1 -10 -10 V48 a10 10 0 0 1 10 -10 z"
        fill="hsl(var(--card))"
      />
    </g>

    {/* Three dots in the bubble */}
    <circle cx="52" cy="57" r="3" fill="hsl(var(--primary))" />
    <circle cx="63" cy="57" r="3" fill="hsl(var(--primary))" />
    <circle cx="74" cy="57" r="3" fill="hsl(var(--primary))" />

    {/* Sparkle decorations */}
    <path
      d="M99 28 L101 33 L106 35 L101 37 L99 42 L97 37 L92 35 L97 33 Z"
      fill="hsl(var(--primary))"
    />
    <circle cx="105" cy="48" r="2" fill="hsl(var(--primary) / 0.6)" />
    <path
      d="M22 88 L23 91 L26 92 L23 93 L22 96 L21 93 L18 92 L21 91 Z"
      fill="hsl(var(--primary) / 0.5)"
    />

    <defs>
      <filter
        id="chat-shadow"
        x="22"
        y="32"
        width="82"
        height="62"
        filterUnits="userSpaceOnUse"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
        <feOffset dy="2" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.08" />
        </feComponentTransfer>
        <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);
