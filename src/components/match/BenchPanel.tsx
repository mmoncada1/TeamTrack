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
    <div className="mt-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Bench <span className="font-normal">({count})</span>
      </h2>
      <div
        ref={setNodeRef}
        className={clsx(
          'mt-2 flex min-h-[6rem] flex-wrap gap-2 rounded-lg border-2 border-dashed border-slate-300 p-3 dark:border-slate-600',
          isOver && 'border-blue-400 bg-blue-50 dark:bg-blue-950/30',
        )}
      >
        {count === 0 && <p className="self-center text-sm text-slate-400">No players on the bench.</p>}
        {children}
      </div>
      {unavailableSection}
    </div>
  );
}
