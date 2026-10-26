import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { getSettings } from '../../db/settings';
import { updateTemplate } from '../../db/templates';
import type { ProtocolTemplate } from '../../types';
import { prepareSteps } from '../import/ImportPage';
import { detectHazards } from '../import/hazards';
import { parseTemplateSource, templateToJson, templateToMarkdown, type SourceFormat } from './templateSource';

const TOGGLE = 'min-h-12 rounded-xl border px-4 font-medium';

function sourceFor(format: SourceFormat, template: ProtocolTemplate): string {
  return format === 'json' ? templateToJson(template) : templateToMarkdown(template);
}

/** Advanced mode only: edit the whole template as raw JSON or Markdown. Validated before anything is saved. */
export function TemplateSourceEditor({ template }: { template: ProtocolTemplate }) {
  const settings = useLiveQuery(() => getSettings(db), [], undefined);
  const [format, setFormat] = useState<SourceFormat>('json');
  const [text, setText] = useState(() => templateToJson(template));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (settings?.mode !== 'advanced') return null;

  function chooseFormat(next: SourceFormat) {
    setFormat(next);
    setText(sourceFor(next, template));
    setError(null);
  }

  async function save() {
    setError(null);
    const result = parseTemplateSource(format, text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    try {
      const steps = prepareSteps(result.steps);
      await updateTemplate(
        template.id,
        { title: result.title ?? template.title, steps, hazards: result.hazards.length ? result.hazards : detectHazards(steps) },
        db,
      );
      // The form above holds its own copy of the steps. Reloading shows the saved version, so a later form save cannot overwrite this one.
      window.location.reload();
    } catch {
      setError('Could not save the protocol. Try again.');
      setBusy(false);
    }
  }

  return (
    <details className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <summary className="min-h-12 cursor-pointer text-lg font-semibold">Raw source (advanced)</summary>
      <div role="group" aria-label="Source format" className="flex flex-wrap gap-2">
        {(['json', 'markdown'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={format === f}
            onClick={() => chooseFormat(f)}
            className={`${TOGGLE} ${format === f ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface-2 text-text'}`}
          >
            {f === 'json' ? 'JSON' : 'Markdown'}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-2">
        <span className="font-medium">{format === 'json' ? 'Protocol JSON' : 'Protocol outline (Markdown)'}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={16}
          className="w-full rounded-xl border border-border-strong bg-surface p-3 font-mono text-sm text-text"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-100 p-3 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
          {error}
        </p>
      )}
      <p className="text-sm text-text-muted">Saving replaces the steps above with this source, then reloads the page.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => chooseFormat(format)} className={`${TOGGLE} border-border bg-surface-2 text-text`}>
          Reset to saved
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="min-h-12 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-50"
        >
          Validate and save
        </button>
      </div>
    </details>
  );
}
