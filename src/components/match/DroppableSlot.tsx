import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { FormationPosition } from '../../types';

interface DroppableSlotProps {
  position: FormationPosition;
  occupied: boolean;
  children?: ReactNode;
}

const GROUP_ABBR: Record<FormationPosition['group'], string> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
};

export function DroppableSlot({ position, occupied, children }: DroppableSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: position.id, data: { positionId: position.id } });

  return (
    <div
      ref={setNodeRef}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      className={clsx(
        'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg transition-colors',
        isOver && 'bg-blue-500/25 ring-2 ring-blue-400',
        !occupied && 'h-16 w-16 rounded-full border-2 border-dashed border-white/70',
      )}
      aria-label={`${position.label} (${GROUP_ABBR[position.group]})${occupied ? '' : ', empty'}`}
    >
      {children ?? (
        <span className="pointer-events-none select-none rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {position.label}
        </span>
      )}
    </div>
  );
}
