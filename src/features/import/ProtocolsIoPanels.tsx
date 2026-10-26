import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  downloadText,
  exportFileName,
  exportMarkdown,
  exportProtocolsIoJson,
  fetchProtocolsIoJson,
  importProtocolsIoJson,
  ProtocolsIoError,
  saveImportedTemplate,
  type ExportSource,
} from './protocolsIo';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium disabled:opacity-50';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
const FIELD =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const CARD = 'flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900';

/** Download buttons: the protocols.io-compatible JSON and a Markdown copy of the protocol. */
export function ProtocolsIoExportButtons({ source }: { source: ExportSource }) {
  const name = source.title.trim() || 'Untitled protocol';
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Export protocol">
      <button
        type="button"
        className={BUTTON_SECONDARY}
        onClick={() => downloadText(exportFileName(name, 'json'), exportProtocolsIoJson({ ...source, title: name }), 'application/json')}
      >
        Export JSON (protocols.io)
      </button>
      <button
        type="button"
        className={BUTTON_SECONDARY}
        onClick={() => downloadText(exportFileName(name, 'md'), exportMarkdown({ ...source, title: name }), 'text/markdown')}
      >
        Export Markdown
      </button>
    </div>
  );
}

function messageOf(err: unknown): string {
  return err instanceof ProtocolsIoError ? err.message : 'The import failed. Please try again.';
}

/** Import a protocols.io JSON file, or a public protocols.io link, as a new protocol. */
export function ProtocolsIoImport() {
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'file' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importText(text: string) {
    const template = importProtocolsIoJson(text);
    await saveImportedTemplate(template);
    navigate(`/library/${template.id}`);
  }

  async function handleFile(file: File) {
    setBusy('file');
    setError(null);
    try {
      await importText(await file.text());
    } catch (err) {
      setError(messageOf(err));
      setBusy(null);
    }
  }

  async function handleLink() {
    setBusy('link');
    setError(null);
    try {
      await importText(await fetchProtocolsIoJson(link));
    } catch (err) {
      setError(messageOf(err));
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="pio-import-heading" className={CARD}>
      <div className="flex flex-col gap-1">
        <h2 id="pio-import-heading" className="text-lg font-semibold">
          Import from protocols.io
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Choose a protocol exported as JSON from protocols.io, or paste a public protocols.io link (needs an internet connection). The
          original title, authors and link are kept as the source.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-100 p-3 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className={`${BUTTON_SECONDARY} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {busy === 'file' ? 'Importing…' : 'Choose JSON file'}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy !== null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-medium">protocols.io link</span>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.protocols.io/view/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className={FIELD}
        />
      </label>
      <div>
        <button type="button" className={BUTTON_PRIMARY} disabled={!link.trim() || busy !== null} onClick={() => void handleLink()}>
          {busy === 'link' ? 'Fetching…' : 'Fetch and import'}
        </button>
      </div>
    </section>
  );
}
