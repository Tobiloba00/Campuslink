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
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("text-foreground", className)}
      >
        {/* Orbit ring */}
        <ellipse
          cx="50"
          cy="50"
          rx="42"
          ry="42"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
        />

        {/* Tilted orbit ring */}
        <ellipse
          cx="50"
          cy="50"
          rx="44"
          ry="16"
          transform="rotate(-30 50 50)"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
        />

        {/* Graduation cap — top diamond */}
        <path
          d="M50 28L68 37L50 46L32 37Z"
          fill="currentColor"
          opacity="0.15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Cap body */}
        <path
          d="M38 39V50C38 53 43 56 50 56C57 56 62 53 62 50V39"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tassel line */}
        <path
          d="M50 37V52"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />

        {/* Tassel end */}
        <circle cx="50" cy="54" r="1.5" fill="currentColor" />

        {/* Diploma scroll */}
        <rect
          x="42"
          y="58"
          width="18"
          height="8"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          transform="rotate(-8 51 62)"
        />

        {/* Diploma ribbon */}
        <path
          d="M48 66L46 71M53 65L51 70"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* 4-point stars */}
        {/* Top star */}
        <path
          d="M62 14L63 16.5L65.5 17.5L63 18.5L62 21L61 18.5L58.5 17.5L61 16.5Z"
          fill="currentColor"
        />
        {/* Left star */}
        <path
          d="M12 45L13 47.5L15.5 48.5L13 49.5L12 52L11 49.5L8.5 48.5L11 47.5Z"
          fill="currentColor"
          opacity="0.7"
        />
        {/* Right star */}
        <path
          d="M88 52L89 54.5L91.5 55.5L89 56.5L88 59L87 56.5L84.5 55.5L87 54.5Z"
          fill="currentColor"
          opacity="0.7"
        />
        {/* Bottom star */}
        <path
          d="M55 83L56 85.5L58.5 86.5L56 87.5L55 90L54 87.5L51.5 86.5L54 85.5Z"
          fill="currentColor"
          opacity="0.5"
        />
      </svg>

      {showText && (
        <span className={cn("font-display font-bold tracking-tight", textClassName)}>
          CampusLink
        </span>
      )}
    </div>
  );
}
