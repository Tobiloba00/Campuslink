import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, X, Send, Trash2, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const SUGGESTED_QUESTIONS = [
  "How do I create a post?",
  "How does the rating system work?",
  "What categories can I post in?",
  "How do I message someone?",
  "Tips for getting more responses?",
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
          behavior: smooth ? 'smooth' : 'instant'
        });
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen]);

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
    // Reset textarea height
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

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <>
      {/* FAB Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-40 rounded-full shadow-xl flex items-center justify-center",
          "bg-gradient-to-br from-primary to-primary/80 text-white",
          "transition-all duration-300 hover:scale-110 active:scale-95",
          "hover:shadow-primary/40 hover:shadow-2xl",
          isMobile ? "bottom-[76px] right-3" : "bottom-6 right-6",
          isOpen && "pointer-events-none opacity-0 scale-50",
          !isVisible && isMobile ? "scale-75 opacity-40" : "opacity-100",
          isMobile ? "h-12 w-12" : "h-14 w-14"
        )}
        aria-label="Open AI Assistant"
      >
        <Sparkles className={cn(isMobile ? "h-5 w-5" : "h-6 w-6")} />
        {/* Pulse ring */}
        {!isOpen && messages.length === 0 && (
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-40" />
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-background border shadow-2xl transition-all duration-300 ease-out overflow-hidden",
          isMobile
            ? "inset-x-0 bottom-0 rounded-t-2xl max-h-[85dvh] h-[85dvh] safe-area-inset-bottom"
            : "bottom-6 right-6 w-[400px] h-[580px] rounded-2xl border-border/50",
          isOpen
            ? "translate-y-0 opacity-100"
            : isMobile
              ? "translate-y-full opacity-0 pointer-events-none"
              : "translate-y-4 opacity-0 pointer-events-none scale-95"
        )}
      >
        {/* Handle bar (mobile only) */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">CampusLink AI</h3>
              <p className="text-[10px] text-muted-foreground leading-none">
                {isLoading ? 'Thinking...' : 'Your campus assistant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                onClick={clearMessages}
                title="Clear chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 relative overflow-hidden">
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="px-4 py-3">
              {messages.length === 0 ? (
                <div className="space-y-4 pt-4">
                  <div className="text-center pb-2">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
                      <Sparkles className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-bold text-base mb-1">Hi there! 👋</h3>
                    <p className="text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
                      I'm your CampusLink assistant. Ask me anything about using the platform!
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                      Quick questions
                    </p>
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(q)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl bg-muted/40 hover:bg-muted border border-transparent hover:border-border/30 text-sm transition-all active:scale-[0.98]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center mr-2 mt-1 shrink-0">
                          <Sparkles className="h-3 w-3 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
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

                  {/* Typing indicator */}
                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex justify-start">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center mr-2 mt-1 shrink-0">
                        <Sparkles className="h-3 w-3 text-primary" />
                      </div>
                      <div className="bg-muted/60 border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Scroll to bottom button */}
          {showScrollDown && (
            <button
              onClick={() => scrollToBottom()}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-background border border-border/50 shadow-lg flex items-center justify-center hover:bg-muted transition-all"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-border/50 p-3 bg-background/80 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              disabled={isLoading}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-muted/40 border border-border/30 rounded-xl px-3.5 py-2.5 text-sm",
                "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
                "min-h-[40px] max-h-[120px] transition-colors",
                "disabled:opacity-50"
              )}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 shrink-0 transition-all disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
