import { useEffect, useRef } from 'react';
import { SHORTCUT_HELP } from './shortcuts';

/** Modal list of the run shortcuts. Escape, the Close button or a click outside closes it. */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-6 text-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="shortcut-help-title" className="text-2xl font-semibold">
          Keyboard shortcuts
        </h2>
        <dl className="flex flex-col gap-3 text-lg">
          {SHORTCUT_HELP.map((row) => (
            <div key={row.keys} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono font-semibold">{row.keys}</dt>
              <dd className="text-right">{row.action}</dd>
            </div>
          ))}
        </dl>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-on-accent"
        >
          Close
        </button>
      </div>
    </div>
  );
}
