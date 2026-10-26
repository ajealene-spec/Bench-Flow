import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseBenchflowText } from './benchflowFile';
import { importBenchflowPayload } from './library';

const BUTTON_SECONDARY =
'inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface shadow-card px-4 font-medium text-text active:bg-surface-2';

/** Imports a .benchflow.json file into the library and opens it. Mount in the library header. */
export function ImportBenchflowButton() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const payload = parseBenchflowText(await file.text());
      const { templateId } = await importBenchflowPayload(payload);
      navigate(`/library/${templateId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be imported.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className={BUTTON_SECONDARY}>
        {busy ? 'Importing…' : 'Import .benchflow.json'}
        <input
          type="file"
          accept=".json,.benchflow.json,application/json"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="max-w-xs text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
