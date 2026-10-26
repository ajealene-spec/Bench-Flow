import { useState } from 'react';
import type { BenchflowPayload } from './benchflowFile';
import { buildShareLink, type ShareLink } from './shareLink';
import { downloadBenchflowFile, shareFile, shareLink, type ShareOutcome } from './shareActions';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY =`${BUTTON} border border-border bg-surface shadow-card text-text active:bg-surface-2`;

const OUTCOME_TEXT: Record<ShareOutcome, string> = {
  shared: 'Shared.',
  copied: 'Link copied to the clipboard.',
  downloaded: 'Saved the .benchflow.json file.',
  cancelled: 'Sharing cancelled.',
  failed: 'Could not share. Select the link below and copy it by hand.',
};

/** Export, share link and native share for one protocol. The payload is built by the parent. */
export function ShareProtocolPanel({ payload }: { payload: BenchflowPayload }) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Share links leave out comments to stay short; the file keeps them.
  const linkPayload: BenchflowPayload = { ...payload, comments: undefined };

  async function makeLink(): Promise<ShareLink> {
    const built = await buildShareLink(window.location.origin, linkPayload);
    setLink(built);
    return built;
  }

  async function onShareLink() {
    setBusy(true);
    try {
      // Rebuild every time so the link never holds an older copy of the protocol.
      const built = await makeLink();
      if (built.tooLong) {
        setStatus(`This link is about ${Math.round(built.bytes / 1024)} KB, which is long. Chat apps may cut it off, so sharing the file is safer.`);
        return;
      }
      setStatus(OUTCOME_TEXT[await shareLink(built.url, payload.metadata.title)]);
    } finally {
      setBusy(false);
    }
  }

  async function onShareFile() {
    setBusy(true);
    try {
      setStatus(OUTCOME_TEXT[await shareFile(payload)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="share-heading" className="flex flex-col gap-3">
      <h2 id="share-heading" className="text-xl font-semibold">
        Share
      </h2>
      <p className="text-sm text-text-muted">
        A link opens a read-only copy in Bench Flow. The file (.benchflow.json) includes comments and can be imported from the Library.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_PRIMARY} disabled={busy} onClick={() => void onShareLink()}>
          Share link
        </button>
        <button type="button" className={BUTTON_SECONDARY} disabled={busy} onClick={() => void onShareFile()}>
          Share file
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={() => downloadBenchflowFile(payload)}>
          Download .benchflow.json
        </button>
      </div>
      {link && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Link</span>
          <textarea
            readOnly
            rows={3}
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-24 rounded-lg border border-border bg-surface shadow-card p-2 font-mono text-xs"
          />
        </label>
      )}
      <p role="status" className="text-sm text-text-muted">
        {status}
      </p>
    </section>
  );
}
