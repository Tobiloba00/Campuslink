import { memo } from "react";

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const ReactionPicker = memo(({ onSelect, onClose }: ReactionPickerProps) => {
  return (
    <div
      className="flex items-center gap-0.5 bg-background border border-border/50 shadow-xl rounded-full px-2 py-1.5 animate-in fade-in zoom-in-90 duration-200"
      onMouseLeave={onClose}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted hover:scale-125 transition-all duration-150 text-lg"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
});

ReactionPicker.displayName = 'ReactionPicker';
