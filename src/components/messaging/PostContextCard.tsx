import { useNavigate } from "react-router-dom";
import { ChevronRight, X, ImageIcon } from "lucide-react";
import { PostContext } from "./types";

interface PostContextCardProps {
  postContext: PostContext;
  onClear?: () => void;
}

// Pinned card shown between ChatHeader and ChatView when a chat is opened
// in the context of a specific post (e.g. someone clicked "I Can Help" or
// "Buy" on a feed card). Shows the post thumbnail + title + price + chevron.
export const PostContextCard = ({ postContext, onClear }: PostContextCardProps) => {
  const navigate = useNavigate();

  return (
    <div className="px-3 sm:px-4 pt-3 pb-3 border-b border-border/40 bg-background flex-shrink-0">
      <button
        onClick={() => navigate(`/post/${postContext.id}`)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors text-left active:scale-[0.99]"
      >
        {/* Thumbnail */}
        <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {postContext.image_url ? (
            <img
              src={postContext.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-primary/10">
              <ImageIcon className="h-5 w-5 text-primary/40" />
            </div>
          )}
        </div>

        {/* Title + price */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate text-foreground">
            {postContext.title}
          </p>
          {postContext.optional_price != null && (
            <p className="text-primary font-bold text-sm mt-0.5 leading-tight">
              ₦{postContext.optional_price.toLocaleString()}
            </p>
          )}
        </div>

        {/* Chevron / clear */}
        {onClear ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onClear(); } }}
            className="p-1.5 rounded-full hover:bg-background flex-shrink-0"
            aria-label="Remove post context"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </span>
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
      </button>
    </div>
  );
};
