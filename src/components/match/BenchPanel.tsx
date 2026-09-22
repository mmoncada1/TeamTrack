import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';

interface BenchPanelProps {
  children: ReactNode;
  unavailableSection?: ReactNode;
  count: number;
}

export function BenchPanel({ children, unavailableSection, count }: BenchPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'BENCH' });

  return (
    <div className="flex flex-col sm:h-full sm:min-h-0">
      <h2 className="flex h-7 shrink-0 items-center text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Bench <span className="font-normal">({count})</span>
      </h2>
      <div
        ref={setNodeRef}
        className={clsx(
          // On sm+ this fills the rest of the column (matches FieldCanvas's h-full via
          // FIELD_HEIGHT_CLASS) and scrolls internally if there are more bench players than fit.
          'grid min-h-[6rem] grid-cols-2 content-start gap-2 overflow-y-auto rounded-lg border-2 border-dashed border-slate-300 p-3 dark:border-slate-600 sm:min-h-0 sm:flex-1',
          isOver && 'border-blue-400 bg-blue-50 dark:bg-blue-950/30',
        )}
      >
        {count === 0 && <p className="col-span-2 self-center text-center text-sm text-slate-400">No players on the bench.</p>}
        {children}
      </div>
      {unavailableSection}
    </div>
  );
}
