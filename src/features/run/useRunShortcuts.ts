import { useEffect, useRef } from 'react';
import { isEditableTarget, shortcutFor, type ShortcutAction } from './shortcuts';

/** Listens for run shortcuts while enabled. Keys typed into text fields are ignored. */
export function useRunShortcuts(enabled: boolean, onAction: (action: ShortcutAction) => void): void {
  const latest = useRef(onAction);
  useEffect(() => {
    latest.current = onAction;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const action = shortcutFor(event.key, {
        editable: isEditableTarget(event.target),
        modifier: event.ctrlKey || event.metaKey || event.altKey,
      });
      if (!action) return;
      // Holding a key repeats next and back, but not timer toggles or completion.
      if (event.repeat && action !== 'next' && action !== 'back') return;
      event.preventDefault();
      latest.current(action);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
