import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Send, X, Loader2, Sparkles } from "lucide-react";
import { compressImage } from "@/lib/imageUtils";
import { toast } from "sonner";
import { PostContext } from "./types";
import { Card } from "@/components/ui/card";

interface MessageInputProps {
  onSendMessage: (text: string, imageFile: File | null, imagePreview: string | null) => Promise<void>;
  onTyping: () => void;
  isOffline: boolean;
  postContext: PostContext | null;
  onClearPostContext: () => void;
  aiSuggestions: string[];
  onSelectAiSuggestion: (suggestion: string) => void;
  messagesCount: number;
}

export const MessageInput = ({
  onSendMessage,
  onTyping,
  isOffline,
  postContext,
  onClearPostContext,
  aiSuggestions,
  onSelectAiSuggestion,
  messagesCount
}: MessageInputProps) => {
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.error('Invalid file type. Please select a JPEG, PNG, or WebP image.');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
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
    if ((!text.trim() && !selectedImage) || isOffline) return;
    
    setIsSending(true);
    const textToSend = text;
    const imgToSend = selectedImage;
    const previewToSend = imagePreview;
    
    // Clear instantly for optimistic UI feel
    setText("");
    clearImage();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }

    try {
      await onSendMessage(textToSend, imgToSend, previewToSend);
    } catch {
      // Restore on fail (this is handled slightly differently in parent but we can restore here)
      setText(textToSend);
      if (imgToSend && previewToSend) {
        setSelectedImage(imgToSend);
        setImagePreview(previewToSend);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 sm:p-4 border-t bg-card/60 backdrop-blur-xl flex flex-col gap-3 relative z-10 pb-safe">
      
      {/* AI Suggestions (Only show initially) */}
      {aiSuggestions.length > 0 && messagesCount === 0 && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider flex items-center gap-1.5 ml-1">
            <Sparkles className="h-3 w-3" />
            AI Conversation Starters
          </p>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSelectAiSuggestion(suggestion)}
                className="text-left text-xs bg-primary/5 hover:bg-primary/10 border border-primary/10 hover:border-primary/20 rounded-2xl px-4 py-2.5 transition-all text-foreground/80 hover:text-foreground active:scale-95"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Post Context */}
      {postContext && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-2xl border border-border/40 mb-1 animate-in zoom-in duration-300">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-xs truncate">
              Replying to: <span className="font-semibold">{postContext.title}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full opacity-70 hover:opacity-100 shrink-0" onClick={onClearPostContext}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="relative inline-block self-start mb-1 animate-in zoom-in slide-in-from-bottom-2 duration-300">
          <img src={imagePreview} alt="Preview" className="h-24 md:h-32 object-cover rounded-xl border-2 border-primary/20 shadow-md" />
          {isCompressing && (
            <div className="absolute inset-0 bg-background/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-lg"
            onClick={clearImage}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
          disabled={isCompressing || isOffline || isSending}
        />
        
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors h-10 w-10 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing || isOffline || isSending}
        >
          <ImageIcon className="h-5 w-5" />
        </Button>

        <div className="flex-1 relative group">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping();
            }}
            onKeyDown={handleKeyDown}
            disabled={isCompressing || isOffline || isSending}
            placeholder={isOffline ? "Waiting for connection..." : "Message..."}
            className="w-full rounded-2xl md:rounded-3xl bg-card border border-border/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 px-4 py-2.5 min-h-[44px] max-h-[120px] resize-none overflow-y-auto leading-relaxed shadow-sm transition-all text-[15px] placeholder:text-muted-foreground/60 focus:shadow-md"
            rows={1}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={isCompressing || isOffline || isSending || (!text.trim() && !selectedImage)}
          className={`rounded-full h-11 w-11 p-0 shadow-md flex-shrink-0 transition-all duration-300 ${
            text.trim() || selectedImage 
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg hover:scale-105 active:scale-95' 
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {isCompressing || isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-4 w-4 ml-0.5" />
          )}
        </Button>
      </div>
    </div>
  );
};
