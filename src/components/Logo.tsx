import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
  variant?: 'full' | 'mark';
}

export function Logo({ className, size = 32, showText = false, textClassName, variant = 'full' }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("text-foreground flex-shrink-0", className)}
        aria-label="CampusLink logo"
      >
        {/* ── Graduation Cap ── */}

        {/* Cap top (mortarboard) — diamond shape with perspective */}
        <path
          d="M60 22L88 36L60 50L32 36Z"
          fill="currentColor"
          opacity="0.12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Inner pattern lines on cap top — gives that ornate engraved feel */}
        <path
          d="M60 28L78 37L60 46L42 37Z"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.25"
          fill="none"
        />
        <path
          d="M60 32L72 38L60 44L48 38Z"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.15"
          fill="none"
        />

        {/* Cap band / base */}
        <path
          d="M40 38V52C40 56.5 48 61 60 61C72 61 80 56.5 80 52V38"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Band bottom curve detail */}
        <path
          d="M44 40V50C44 53.5 50 57 60 57C70 57 76 53.5 76 50V40"
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.2"
          fill="none"
        />

        {/* Center button/rosette on cap */}
        <circle cx="60" cy="36" r="3" fill="currentColor" opacity="0.3" />
        <circle cx="60" cy="36" r="1.8" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.5" />
        <circle cx="60" cy="36" r="0.8" fill="currentColor" opacity="0.6" />

        {/* Tassel cord from center */}
        <path
          d="M60 36Q62 42 80 44Q82 45 82 47L82 48"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tassel knot */}
        <ellipse cx="82" cy="50" rx="2.5" ry="2" fill="currentColor" opacity="0.5" />

        {/* Tassel threads — flowing downward */}
        <path
          d="M80 51.5Q79 58 78 66"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M81 52Q80.5 59 80 67"
          stroke="currentColor"
          strokeWidth="0.8"
          opacity="0.4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M82 52Q82 59 82 67"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M83 52Q83.5 59 84 67"
          stroke="currentColor"
          strokeWidth="0.8"
          opacity="0.4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M84 51.5Q85 58 86 66"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tassel bottom tips — small dots */}
        <circle cx="78" cy="67" r="0.7" fill="currentColor" opacity="0.4" />
        <circle cx="80" cy="68" r="0.7" fill="currentColor" opacity="0.4" />
        <circle cx="82" cy="68" r="0.7" fill="currentColor" opacity="0.4" />
        <circle cx="84" cy="68" r="0.7" fill="currentColor" opacity="0.4" />
        <circle cx="86" cy="67" r="0.7" fill="currentColor" opacity="0.4" />

        {/* ── Sparkle / Star accents ── */}

        {/* Top-right sparkle — 4-point star */}
        <path
          d="M92 18L93.2 22L97 23.2L93.2 24.4L92 28.2L90.8 24.4L87 23.2L90.8 22Z"
          fill="currentColor"
          opacity="0.8"
        />

        {/* Top-left small sparkle */}
        <path
          d="M28 20L28.8 22.5L31.2 23.2L28.8 24L28 26.4L27.2 24L24.8 23.2L27.2 22.5Z"
          fill="currentColor"
          opacity="0.45"
        />

        {/* Left sparkle */}
        <path
          d="M14 55L15.2 58.5L18.5 59.5L15.2 60.5L14 64L12.8 60.5L9.5 59.5L12.8 58.5Z"
          fill="currentColor"
          opacity="0.5"
        />

        {/* Bottom-left sparkle */}
        <path
          d="M30 88L31 91L34 92L31 93L30 96L29 93L26 92L29 91Z"
          fill="currentColor"
          opacity="0.35"
        />

        {/* Bottom-right small sparkle */}
        <path
          d="M96 78L96.8 80.2L99 81L96.8 81.8L96 84L95.2 81.8L93 81L95.2 80.2Z"
          fill="currentColor"
          opacity="0.4"
        />

        {/* Subtle particle dots around cap — gives that stippled/engraved texture feel */}
        <circle cx="25" cy="38" r="0.5" fill="currentColor" opacity="0.2" />
        <circle cx="95" cy="35" r="0.5" fill="currentColor" opacity="0.2" />
        <circle cx="22" cy="65" r="0.4" fill="currentColor" opacity="0.15" />
        <circle cx="98" cy="68" r="0.4" fill="currentColor" opacity="0.15" />
        <circle cx="38" cy="80" r="0.5" fill="currentColor" opacity="0.15" />
        <circle cx="60" cy="85" r="0.4" fill="currentColor" opacity="0.1" />
        <circle cx="35" cy="16" r="0.4" fill="currentColor" opacity="0.15" />
        <circle cx="75" cy="14" r="0.3" fill="currentColor" opacity="0.12" />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            "font-display font-extrabold tracking-tight leading-none",
            textClassName
          )}>
            CampusLink
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal mark-only version for tight spaces (favicon, tab bar, etc.)
 * Just the cap silhouette — no stars, no text
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
      <path
        d="M24 6L40 14L24 22L8 14Z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner detail */}
      <path
        d="M24 10L34 15L24 20L14 15Z"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.2"
        fill="none"
      />
      {/* Center dot */}
      <circle cx="24" cy="14" r="1.2" fill="currentColor" opacity="0.5" />
      {/* Cap body */}
      <path
        d="M13 15.5V24C13 26.5 17.5 29 24 29C30.5 29 35 26.5 35 24V15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Tassel cord */}
      <path
        d="M24 14Q25 18 35 19.5Q36 20 36 21"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Tassel threads */}
      <path d="M34.5 22Q34 27 33.5 32" stroke="currentColor" strokeWidth="0.7" opacity="0.5" fill="none" strokeLinecap="round" />
      <path d="M36 22Q36 27 36 32" stroke="currentColor" strokeWidth="0.7" opacity="0.5" fill="none" strokeLinecap="round" />
      <path d="M37.5 22Q38 27 38.5 32" stroke="currentColor" strokeWidth="0.7" opacity="0.5" fill="none" strokeLinecap="round" />
      {/* Sparkle */}
      <path d="M40 6L40.8 8.5L43.2 9.2L40.8 10L40 12.4L39.2 10L36.8 9.2L39.2 8.5Z" fill="currentColor" opacity="0.7" />
      <path d="M7 28L7.6 29.8L9.4 30.3L7.6 30.8L7 32.6L6.4 30.8L4.6 30.3L6.4 29.8Z" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
