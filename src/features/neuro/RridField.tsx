import { useEffect, useState } from 'react';
import { BUTTON_PRIMARY, FIELD_INPUT } from '../data/fieldStyles';
import { rridSearchLinks, validateRrid } from './rrid';

/**
 * RRID entry for a reagent, antibody or animal line. Builds search links from `searchName`,
 * checks the format and saves through onChange only when the RRID is valid (or empty to clear).
 */
export function RridField({
  value,
  onChange,
  searchName = '',
  id = 'rrid',
}: {
  value: string;
  onChange: (rrid: string) => void;
  searchName?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => setDraft(value), [value]);
  const links = rridSearchLinks(searchName);

  function save() {
    if (draft.trim() === '') {
      onChange('');
      setMessage({ tone: 'ok', text: 'RRID cleared.' });
      return;
    }
    const checked = validateRrid(draft);
    if (!checked.ok) {
      setMessage({ tone: 'error', text: checked.message });
      return;
    }
    setDraft(checked.value);
    onChange(checked.value);
    setMessage({ tone: 'ok', text: `Saved ${checked.value}.` });
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <legend className="px-1 text-base font-semibold">RRID</legend>
      <label htmlFor={id} className="flex flex-col gap-1 text-base font-medium">
        Paste an RRID (for example RRID:AB_2298772)
        <input id={id} className={FIELD_INPUT} value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON_PRIMARY} onClick={save}>
          Check and save
        </button>
      </div>
      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`text-base ${message.tone === 'error' ? 'text-red-700 dark:text-red-300' : ''}`}>
          {message.text}
        </p>
      )}
      {links.length > 0 && (
        <nav aria-label="Find an RRID" className="flex flex-col gap-1">
          <span className="text-base font-medium">Find the RRID for “{searchName.trim()}”</span>
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center underline underline-offset-4">
                  {l.label} (opens in a new tab)
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </fieldset>
  );
}
