import { useState } from "react";
import { Link } from "react-router-dom";

// Looks for a hero character image in /public/illustrations. Save your file as
// hero-character.png (or .webp). If it's missing, we fall back to the abstract
// SVG that ships with the repo so the card never shows a broken-image icon.
const HERO_PNG = "/illustrations/hero-character.png";
const HERO_SVG_FALLBACK = "/illustrations/hero-student.svg";

export const FeedHero = () => {
  const [imgSrc, setImgSrc] = useState(HERO_PNG);

  return (
    <Link
      to="/create-post"
      className="block lg:hidden relative overflow-hidden rounded-2xl mb-4 transition-transform active:scale-[0.99]"
      aria-label="Post a task"
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />

      {/* Subtle radial highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.18)_0%,transparent_55%)]" />

      <div className="relative flex items-center gap-3 px-5 py-5">
        {/* Copy + CTA */}
        <div className="flex-1 min-w-0 text-white">
          <h2 className="text-[19px] font-extrabold leading-tight tracking-tight">
            Find help.<br />Get things done.
          </h2>
          <p className="text-xs text-white/75 mt-1.5 mb-3.5">
            By students, for students.
          </p>
          <span className="inline-flex items-center bg-white text-primary font-semibold text-[13px] px-4 py-2 rounded-full shadow-sm">
            Post a Task
          </span>
        </div>

        {/* Hero character (PNG preferred, SVG fallback) */}
        <img
          src={imgSrc}
          alt=""
          aria-hidden="true"
          className="h-28 w-auto flex-shrink-0 -mr-1 select-none pointer-events-none object-contain"
          draggable={false}
          onError={() => {
            if (imgSrc !== HERO_SVG_FALLBACK) setImgSrc(HERO_SVG_FALLBACK);
          }}
        />
      </div>
    </Link>
  );
};
