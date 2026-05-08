import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Image as ImageIcon, Send, X, Loader2, Sparkles, Reply, Plus } from "lucide-react";
import { compressImage } from "@/lib/imageUtils";
import { toast } from "sonner";
import { PostContext, ReplyContext } from "./types";

interface MessageInputProps {
  onSendMessage: (text: string, imageFile: File | null, imagePreview: string | null) => Promise<void>;
  onTyping: () => void;
  isOffline: boolean;
  postContext: PostContext | null;
  onClearPostContext: () => void;
  aiSuggestions: string[];
  onSelectAiSuggestion: (suggestion: string) => void;
  messagesCount: number;
  replyTo: ReplyContext | null;
  onClearReply: () => void;
}

export const MessageInput = ({
  onSendMessage,
  onTyping,
  isOffline,
  postContext,
  onClearPostContext,
  aiSuggestions,
  onSelectAiSuggestion,
  messagesCount,
  replyTo,
  onClearReply
}: MessageInputProps) => {
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when reply is set
  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, or WebP image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setIsCompressing(true);
    try {
      const compressedFile = await compressImage(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
      setSelectedImage(compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setIsCompressing(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch {
      setIsCompressing(false);
      toast.error("Failed to process image");
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if ((!text.trim() && !selectedImage) || isOffline || isSending) return;

    setIsSending(true);
    const textToSend = text;
    const imgToSend = selectedImage;
    const previewToSend = imagePreview;

    setText("");
    clearImage();
    onClearReply();
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      await onSendMessage(textToSend, imgToSend, previewToSend);
    } catch {
      setText(textToSend);
      if (imgToSend && previewToSend) {
        setSelectedImage(imgToSend);
        setImagePreview(previewToSend);
      }
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && replyTo) {
      onClearReply();
    }
  };

  const canSend = (text.trim() || selectedImage) && !isCompressing && !isOffline && !isSending;

  return (
    <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl safe-area-inset-bottom">
      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && messagesCount === 0 && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider flex items-center gap-1 mb-2">
            <Sparkles className="h-3 w-3" />
            Conversation Starters
          </p>
          <div className="flex flex-wrap gap-1.5">
            {aiSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSelectAiSuggestion(suggestion)}
                className="text-left text-xs bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 rounded-xl px-3 py-2 transition-all text-foreground/80 hover:text-foreground active:scale-95"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Post-quote preview — shown BEFORE the message is sent, so the user
          sees exactly what they're about to attach. Mirrors WhatsApp's
          "Reply Privately" preview pinned just above the keyboard. */}
      {postContext && (
        <div className="px-4 pt-3">
          <div className="flex items-stretch gap-2 px-2 py-2 bg-primary/5 rounded-xl border-l-2 border-primary overflow-hidden">
            {postContext.image_url ? (
              <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-muted/40">
                <img src={postContext.image_url} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0 py-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary leading-none">
                Replying about post
              </p>
              <p className="text-xs font-semibold text-foreground truncate mt-1 leading-tight">
                {postContext.title}
              </p>
              {postContext.optional_price != null && (
                <p className="text-[11px] text-primary font-semibold leading-tight">
                  ₦{Number(postContext.optional_price).toLocaleString()}
                </p>
              )}
            </div>
            <button onClick={onClearPostContext} className="p-1 rounded-full hover:bg-muted transition-colors flex-shrink-0 self-start">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Reply context */}
      {replyTo && (
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl border-l-2 border-primary">
            <Reply className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary">{replyTo.senderName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {replyTo.imageUrl ? '📷 Photo' : replyTo.text || ''}
              </p>
            </div>
            <button onClick={onClearReply} className="p-1 rounded-full hover:bg-muted transition-colors flex-shrink-0">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pt-3">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 sm:h-24 object-cover rounded-xl border border-border/50" />
            {isCompressing && (
              <div className="absolute inset-0 bg-background/60 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input row — matches mockup: + (attach) on left, input pill, circular send on right */}
      <div className="flex items-end gap-2 p-3 sm:p-4">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
          disabled={isCompressing || isOffline || isSending}
        />

        <button
          className="h-10 w-10 rounded-full bg-muted/60 hover:bg-muted text-foreground/70 hover:text-foreground flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing || isOffline || isSending}
          aria-label="Attach image"
        >
          <Plus className="h-5 w-5" strokeWidth={2.2} />
        </button>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping();
            }}
            onKeyDown={handleKeyDown}
            disabled={isCompressing || isOffline || isSending}
            placeholder={isOffline ? "Waiting for connection..." : "Type a message..."}
            className="w-full rounded-full bg-muted/40 border border-border/30 focus:border-primary/30 focus:ring-1 focus:ring-primary/15 px-4 py-2.5 min-h-[40px] max-h-[120px] resize-none overflow-y-auto chat-text leading-relaxed placeholder:text-muted-foreground/40 transition-all outline-none"
            rows={1}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
            canSend
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg hover:scale-105 active:scale-95'
              : 'bg-muted/60 text-muted-foreground/30'
          }`}
          aria-label="Send"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-[18px] w-[18px] -mr-[2px]" />
          )}
        </button>
      </div>
    </div>
  );
};
