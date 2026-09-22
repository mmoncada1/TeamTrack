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
    <div className="flex flex-col">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Bench <span className="font-normal">({count})</span>
      </h2>
      <div
        ref={setNodeRef}
        className={clsx(
          // Height mirrors FieldCanvas's FIELD_HEIGHT_CLASS (`h-[min(68vh,880px)]`) so the
          // bench box matches the field's height on the same row. Tailwind needs the full
          // class literal here (not interpolated) to pick it up during the content scan.
          'mt-2 grid min-h-[6rem] grid-cols-2 content-start gap-2 overflow-y-auto rounded-lg border-2 border-dashed border-slate-300 p-3 dark:border-slate-600 sm:h-[min(68vh,880px)]',
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
