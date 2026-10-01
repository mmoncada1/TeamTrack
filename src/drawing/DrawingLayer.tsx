import type { Drawing } from './types';
import { pathData } from './geometry';

export function DrawingLayer({
  drawings,
  arrowId,
  erase,
}: {
  drawings: Drawing[];
  arrowId: string;
  erase?: (id: string) => void;
}) {
  return (
    <g>
      {drawings.map((d) => (
        <path
          key={d.id}
          d={pathData(d.points)}
          fill="none"
          stroke={d.color}
          strokeWidth={d.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={d.tool === 'arrow' ? `url(#${arrowId})` : undefined}
          style={{
            cursor: erase ? 'crosshair' : undefined,
            pointerEvents: erase ? 'stroke' : 'none',
          }}
          onPointerDown={
            erase
              ? (e) => {
                  e.stopPropagation();
                  erase(d.id);
                }
              : undefined
          }
        />
      ))}
    </g>
  );
}
