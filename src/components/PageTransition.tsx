import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);
  const [phase, setPhase] = useState<'enter' | 'idle'>('enter');
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPathRef.current) {
      setDisplayedChildren(children);
      return;
    }

    prevPathRef.current = location.pathname;
    setTransitioning(true);
    setPhase('enter');

    // Small delay to ensure the exit animation plays
    const timeout = setTimeout(() => {
      setDisplayedChildren(children);
      setTransitioning(false);
      // Reset scroll
      window.scrollTo(0, 0);
    }, 80);

    return () => clearTimeout(timeout);
  }, [location.pathname, children]);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        transitioning
          ? "opacity-0 translate-y-2"
          : "opacity-100 translate-y-0"
      )}
    >
      {displayedChildren}
    </div>
  );
}
