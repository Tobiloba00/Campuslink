import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      setIsAnimating(true);
      window.scrollTo(0, 0);

      // Remove animation class after it plays
      const timer = setTimeout(() => setIsAnimating(false), 250);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  return (
    <div
      key={location.pathname}
      className={isAnimating ? 'animate-page-enter' : undefined}
    >
      {children}
    </div>
  );
}
