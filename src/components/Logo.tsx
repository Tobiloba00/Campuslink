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
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("text-foreground flex-shrink-0", className)}
        aria-label="CampusLink logo"
      >
        {/* ── Graduation Cap — Bold & Confident ── */}

        {/* Cap top (mortarboard) — thick strokes */}
        <path
          d="M60 24L90 38L60 52L30 38Z"
          fill="currentColor"
          opacity="0.18"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Inner diamond detail */}
        <path
          d="M60 30L80 39L60 48L40 39Z"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.3"
          fill="none"
        />

        {/* Center rosette — bold */}
        <circle cx="60" cy="38" r="4" fill="currentColor" opacity="0.45" />
        <circle cx="60" cy="38" r="2.2" fill="currentColor" opacity="0.8" />

        {/* Cap body — bold stroke */}
        <path
          d="M38 40V54C38 59 47 64 60 64C73 64 82 59 82 54V40"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tassel cord — bold */}
        <path
          d="M60 38Q63 46 82 48Q84 49 84 52"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tassel knot */}
        <ellipse cx="84" cy="54" rx="3.5" ry="2.8" fill="currentColor" opacity="0.65" />

        {/* Tassel threads — bolder */}
        <path d="M81 56Q80 64 79 74" stroke="currentColor" strokeWidth="1.8" opacity="0.55" fill="none" strokeLinecap="round" />
        <path d="M83 56Q82.5 64 82 74" stroke="currentColor" strokeWidth="1.4" opacity="0.45" fill="none" strokeLinecap="round" />
        <path d="M84.5 56Q84.5 64 84.5 74" stroke="currentColor" strokeWidth="1.8" opacity="0.55" fill="none" strokeLinecap="round" />
        <path d="M86 56Q86.5 64 87 74" stroke="currentColor" strokeWidth="1.4" opacity="0.45" fill="none" strokeLinecap="round" />
        <path d="M87.5 56Q88.5 64 89.5 74" stroke="currentColor" strokeWidth="1.8" opacity="0.55" fill="none" strokeLinecap="round" />

        {/* ── Sparkles — bolder ── */}

        {/* Top-right sparkle */}
        <path
          d="M94 14L95.5 19L100.5 20.5L95.5 22L94 27L92.5 22L87.5 20.5L92.5 19Z"
          fill="currentColor"
          opacity="0.85"
        />

        {/* Top-left sparkle */}
        <path
          d="M26 18L27.2 22L31 23.2L27.2 24.4L26 28.2L24.8 24.4L21 23.2L24.8 22Z"
          fill="currentColor"
          opacity="0.5"
        />

        {/* Left sparkle */}
        <path
          d="M14 58L15.5 62.5L20 63.8L15.5 65L14 69.5L12.5 65L8 63.8L12.5 62.5Z"
          fill="currentColor"
          opacity="0.45"
        />

        {/* Bottom sparkle */}
        <path
          d="M38 90L39.2 94L43 95L39.2 96L38 100L36.8 96L33 95L36.8 94Z"
          fill="currentColor"
          opacity="0.35"
        />
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

/**
 * Minimal mark for tight spaces (favicon, tab bar)
 */
export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground flex-shrink-0", className)}
      aria-label="CampusLink"
    >
      {/* Cap top */}
      <path d="M24 6L40 14L24 22L8 14Z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {/* Center dot */}
      <circle cx="24" cy="14" r="1.8" fill="currentColor" opacity="0.7" />
      {/* Cap body */}
      <path d="M13 15.5V24C13 26.5 17.5 29 24 29C30.5 29 35 26.5 35 24V15.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Tassel cord */}
      <path d="M24 14Q25.5 18 35 19.5Q36 20 36 21.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Tassel threads */}
      <path d="M34 23Q33.5 28 33 33" stroke="currentColor" strokeWidth="1" opacity="0.55" fill="none" strokeLinecap="round" />
      <path d="M36 23Q36 28 36 33" stroke="currentColor" strokeWidth="1" opacity="0.55" fill="none" strokeLinecap="round" />
      <path d="M38 23Q38.5 28 39 33" stroke="currentColor" strokeWidth="1" opacity="0.55" fill="none" strokeLinecap="round" />
      {/* Sparkle */}
      <path d="M40 5L41 8L44 9L41 10L40 13L39 10L36 9L39 8Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}
