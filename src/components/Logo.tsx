import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

// Abstract mark: two interlocking discs. Symbolic of "Campus + Link" —
// students connected.
//
// Both discs are hardcoded white. The front disc is rendered at 45%
// opacity so where it overlaps the back you get a clean glassmorphism
// step, and where it sits over the colored backdrop alone you see a
// soft light-blue from the bg bleed-through. The mark is designed to
// always live on a brand-colored backdrop — render it inside a
// primary-tinted chip / FAB / app-icon background.
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
    <circle cx="14" cy="20" r="10" fill="#FFFFFF" />
    <circle cx="26" cy="20" r="10" fill="#FFFFFF" fillOpacity="0.45" />
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
