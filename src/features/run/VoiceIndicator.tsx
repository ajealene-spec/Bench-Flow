import type { VoiceStatus } from './useVoiceControl';

/** Mic status for run mode. The message region is polite live, so each command is announced once. */
export function VoiceIndicator({ status, heard, message }: { status: VoiceStatus; heard: string; message: string }) {
  const label =
    status === 'listening'
      ? 'Voice control is on and listening.'
      : status === 'unsupported'
        ? 'Voice control is not supported in this browser. Use the buttons instead.'
        : status === 'error'
          ? 'Microphone access is blocked. Allow it in browser settings to use voice.'
          : 'Voice control is off.';

  return (
    <section aria-label="Voice control" className="flex flex-col gap-2 rounded-xl border border-border p-3 text-base">
      <p className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`inline-block h-3 w-3 shrink-0 rounded-full ${status === 'listening' ? 'bg-accent' : 'bg-text-muted'}`}
        />
        <span>{label}</span>
      </p>
      {status === 'listening' && (
        <p className="text-text-muted">Say: next, back, start timer, stop timer, repeat, or add note followed by your text.</p>
      )}
      {heard && <p className="text-text-muted">Heard: “{heard}”</p>}
      <p role="status" aria-live="polite" className="font-medium">
        {message}
      </p>
    </section>
  );
}
