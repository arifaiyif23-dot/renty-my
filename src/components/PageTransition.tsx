import { ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div 
      className={prefersReducedMotion ? '' : 'animate-fade-in'}
      style={{ animationDuration: '0.2s' }}
    >
      {children}
    </div>
  );
}
