import type { ReactNode } from 'react';

interface FieldCanvasProps {
  children: ReactNode;
}

/**
 * Draws a soccer pitch entirely with SVG/CSS so the app never depends on a
 * remote or copyrighted image. Positioned children (formation drop zones)
 * are placed on top using percentage coordinates via absolute positioning.
 */
export function FieldCanvas({ children }: FieldCanvasProps) {
  return (
    <div className="relative aspect-[2/3] w-full max-w-xl overflow-hidden rounded-xl bg-pitch shadow-inner sm:aspect-[3/4] md:mx-auto">
      <svg
        viewBox="0 0 100 150"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="100" height="150" fill="#2e7d4f" />
        {/* Mow stripes for visual texture, decorative only */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="0" y={i * 18.75} width="100" height="9.375" fill={i % 2 === 0 ? '#2e7d4f' : '#2b7649'} />
        ))}
        <g stroke="white" strokeWidth="0.6" fill="none">
          <rect x="3" y="3" width="94" height="144" />
          <line x1="3" y1="75" x2="97" y2="75" />
          <circle cx="50" cy="75" r="9" />
          <circle cx="50" cy="75" r="0.8" fill="white" />
          {/* Own goal area (bottom) */}
          <rect x="30" y="128" width="40" height="19" />
          <rect x="40" y="141" width="20" height="6" />
          <path d="M 38 128 A 12 12 0 0 1 62 128" />
          {/* Opponent goal area (top) */}
          <rect x="30" y="3" width="40" height="19" />
          <rect x="40" y="3" width="20" height="6" />
          <path d="M 38 22 A 12 12 0 0 0 62 22" />
        </g>
      </svg>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
