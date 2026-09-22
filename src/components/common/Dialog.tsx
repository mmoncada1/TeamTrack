import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledById?: string;
}

let dialogCounter = 0;

/** A minimal, accessible modal dialog: focus trap, Escape to close, labelled for screen readers. */
export function Dialog({ open, title, description, onClose, children, footer }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`dialog-title-${++dialogCounter}`);
  const descIdRef = useRef(`dialog-desc-${dialogCounter}`);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && focusable && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idRef.current}
        aria-describedby={description ? descIdRef.current : undefined}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <h2 id={idRef.current} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </h2>
        {description && (
          <p id={descIdRef.current} className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
