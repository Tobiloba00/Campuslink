import { useState, useEffect, useRef } from 'react';

/**
 * Detects scroll direction. Returns 'up' or 'down'.
 * Also returns whether user has scrolled past a threshold (for hiding navbar).
 * Includes a deadzone to prevent jitter on small scroll movements.
 */
export function useScrollDirection(threshold = 10) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;

      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const diff = currentY - lastScrollY.current;

        // Only react if scrolled more than threshold (prevents jitter)
        if (Math.abs(diff) >= threshold) {
          // Hide when scrolling down AND past the top area
          if (diff > 0 && currentY > 80) {
            setHidden(true);
          }
          // Show when scrolling up
          else if (diff < 0) {
            setHidden(false);
          }
          lastScrollY.current = currentY;
        }

        // Always show at top of page
        if (currentY < 20) {
          setHidden(false);
        }

        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return hidden;
}
