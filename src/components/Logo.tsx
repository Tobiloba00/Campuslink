import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

// Abstract mark: two interlocking circles. Symbolic of "Campus + Link" — students
// connected. Replaces the previous graduation-cap mark across the app.
const Mark = ({ size, className }: { size: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("flex-shrink-0", className)}
    aria-label="CampusLink"
  >
    {/* Back disc */}
    <circle cx="14" cy="20" r="10" fill="currentColor" />
    {/* Front disc, lighter so they read as overlapping/linked */}
    <circle cx="26" cy="20" r="10" fill="currentColor" opacity="0.55" />
  </svg>
);

export function Logo({ className, size = 32, showText = false, textClassName }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <Mark size={size} className={className} />

      {showText && (
        <span className={cn(
          "font-display font-extrabold tracking-tight leading-none",
          textClassName
        )}>
          <span>Campus</span>{' '}<span>Link</span>
        </span>
      )}
    </div>
  );
}

export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return <Mark size={size} className={className} />;
}
