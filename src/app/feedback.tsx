import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/* ---------- Toasts ---------- */

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  tone?: ToastTone;
  /** Optional action button, for example Undo. The toast stays a little longer when it has one. */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

export const MAX_TOASTS = 3;
const DURATION_MS = 4000;
const DURATION_WITH_ACTION_MS = 8000;

/** Keeps the newest toasts and drops the oldest when there are too many. */
export function addToast(list: ToastItem[], item: ToastItem): ToastItem[] {
  return [...list, item].slice(-MAX_TOASTS);
}

export function toastDuration(options: ToastOptions): number {
  return options.actionLabel ? DURATION_WITH_ACTION_MS : DURATION_MS;
}

interface ToastApi {
  /** Shows a short message. Returns the toast id. */
  toast: (message: string, options?: ToastOptions) => number;
}

/* ---------- Confirm ---------- */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use the danger button and start with Cancel focused. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface FeedbackApi extends ToastApi {
  confirm: ConfirmFn;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

/** Fallback so a component rendered outside the provider (for example in a test) does not crash. */
const FALLBACK: FeedbackApi = {
  toast: () => -1,
  confirm: async () => false,
};

export function useToast(): ToastApi {
  return useContext(FeedbackContext) ?? FALLBACK;
}

/** Returns a promise-based confirm. Use it in place of window.confirm. */
export function useConfirm(): ConfirmFn {
  return (useContext(FeedbackContext) ?? FALLBACK).confirm;
}

/** The mounted provider's confirm. Null outside the provider, where askConfirm answers "no". */
let activeConfirm: ConfirmFn | null = null;

/**
 * Promise-based confirm for event handlers that are not inside a component (or that would need a hook).
 * Replaces window.confirm everywhere. Without a mounted provider it resolves to false, so nothing is deleted silently.
 */
export const askConfirm: ConfirmFn = (options) => (activeConfirm ? activeConfirm(options) : Promise.resolve(false));

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastApi['toast']>(
    (message, options = {}) => {
      const id = nextId.current++;
      setToasts((list) => addToast(list, { id, message, ...options }));
      window.setTimeout(() => dismiss(id), toastDuration(options));
      return id;
    },
    [dismiss],
  );

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A second request while one is open cancels the first, so only one dialog is ever shown.
        setPending((current) => {
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    [],
  );

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  useEffect(() => {
    activeConfirm = confirm;
    return () => {
      if (activeConfirm === confirm) activeConfirm = null;
    };
  }, [confirm]);

  const api = useMemo<FeedbackApi>(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      {pending && <ConfirmDialog options={pending.options} onAnswer={answer} />}
    </FeedbackContext.Provider>
  );
}

function ToastRegion({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            t.tone === 'error'
              ? 'border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100'
              : 'border-border bg-surface text-text'
          }`}
        >
          <span className="flex-1 text-base leading-6">{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button
              type="button"
              className="btn btn-ghost min-h-12 px-3"
              onClick={() => {
                t.onAction?.();
                onDismiss(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss notification"
            className="btn btn-ghost min-h-12 min-w-12 px-0"
            onClick={() => onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (ok: boolean) => void }) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);

  useEffect(() => {
    // Focus Cancel for destructive prompts so Enter does not delete by accident.
    (options.danger ? cancelRef.current : confirmRef.current)?.focus();
    const returnTo = opener.current;
    return () => returnTo?.focus?.();
  }, [options.danger]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onAnswer(false);
      return;
    }
    if (e.key === 'Tab') {
      // Keep focus between the two buttons.
      const focusable = [cancelRef.current, confirmRef.current].filter((el): el is HTMLButtonElement => el !== null);
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
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onKeyDown={onKeyDown}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.message ? messageId : undefined}
        className="card flex w-full max-w-md flex-col gap-4 p-6"
      >
        <h2 id={titleId} className="t-h3">
          {options.title}
        </h2>
        {options.message && (
          <p id={messageId} className="t-body text-text-muted">
            {options.message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => onAnswer(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onAnswer(true)}
          >
            {options.confirmLabel ?? (options.danger ? 'Delete' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}
