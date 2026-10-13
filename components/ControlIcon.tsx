import type { ReactNode } from 'react';

interface ControlIconProps {
  className?: string;
  /** SVG content on a 16×16 box, drawn stroke-only. */
  children: ReactNode;
}

/** The one icon style used by every control floating over the map. */
export function ControlIcon({ className = '', children }: ControlIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
