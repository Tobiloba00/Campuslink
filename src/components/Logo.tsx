import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export function Logo({ className, size = 32, showText = false, textClassName }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("flex-shrink-0", className)}
        aria-label="CampusLink"
      >
        {/*
          Clean geometric graduation cap + link/connection motif.
          Designed to work at 16px–200px. Bold fills, no thin strokes.
        */}

        {/* Cap top — solid filled diamond */}
        <path
          d="M20 4L36 12L20 20L4 12Z"
          fill="currentColor"
        />

        {/* Cap body — solid band */}
        <path
          d="M10 14V22C10 25.5 14.5 28.5 20 28.5C25.5 28.5 30 25.5 30 22V14L20 20L10 14Z"
          fill="currentColor"
          opacity="0.55"
        />

        {/* Tassel — bold single line + circle end */}
        <line x1="30" y1="14" x2="30" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30" cy="34" r="2.2" fill="currentColor" />
      </svg>

      {showText && (
        <span className={cn(
          "font-display font-extrabold tracking-tight leading-none",
          textClassName
        )}>
          CampusLink
        </span>
      )}
    </div>
  );
}

export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
      aria-label="CampusLink"
    >
      <path d="M20 4L36 12L20 20L4 12Z" fill="currentColor" />
      <path d="M10 14V22C10 25.5 14.5 28.5 20 28.5C25.5 28.5 30 25.5 30 22V14L20 20L10 14Z" fill="currentColor" opacity="0.55" />
      <line x1="30" y1="14" x2="30" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="34" r="2.2" fill="currentColor" />
    </svg>
  );
}
