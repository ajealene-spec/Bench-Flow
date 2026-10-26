import { useEffect, useState } from 'react';
import { db } from '../../db';
import { getTemplate } from '../../db/templates';
import { literatureNoteText } from './assistNotes';
import type { LiteratureResult } from './assistPrompts';
import { fetchAssistConfigured, requestLiterature } from './assistApi';
import { dismissLiteratureFor, optOutOfLiterature, shouldOfferLiterature } from './literatureOptOut';
import { stepLines } from './runSummary';

const BUTTON =
'inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface shadow-card px-4 font-medium text-text active:bg-surface-2 disabled:opacity-50';

type Phase = 'hidden' | 'ask' | 'loading' | 'results' | 'error';

/**
 * "Check recent literature for optimizations?" card, shown after a protocol is imported.
 * Hidden when the choice was already made for this template, when "Don't ask again" was chosen,
 * when there is no API key, or when offline. Nothing is applied: suggestions only become notes on request.
 */
export function LiteraturePrompt({
  templateId,
  onAddNote,
}: {
  templateId: string;
  onAddNote: (text: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [result, setResult] = useState<LiteratureResult | null>(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<number[]>([]);

  useEffect(() => {
    setPhase('hidden');
    setResult(null);
    setAdded([]);
    if (!shouldOfferLiterature(templateId) || !navigator.onLine) return;
    let alive = true;
    void fetchAssistConfigured().then((ok) => {
      if (alive && ok) setPhase('ask');
    });
    return () => {
      alive = false;
    };
  }, [templateId]);

  async function checkLiterature() {
    setPhase('loading');
    setError('');
    try {
      const template = await getTemplate(templateId, db);
      if (!template) {
        setError('Protocol not found.');
        setPhase('error');
        return;
      }
      const res = await requestLiterature({ protocolTitle: template.title, steps: stepLines(template.steps) });
      if (res.ok) {
        setResult(res.value);
        setPhase('results');
      } else {
        setError(res.error === 'offline' ? 'Needs an internet connection.' : 'Literature search is unavailable right now. Nothing was changed.');
        setPhase('error');
      }
    } catch {
      setError('Literature search is unavailable right now. Nothing was changed.');
      setPhase('error');
    }
  }

  if (phase === 'hidden') return null;

  return (
    <section aria-labelledby="literature-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-2 p-4">
      <h2 id="literature-heading" className="text-xl font-semibold">
        Check recent literature for optimizations?
      </h2>

      {phase === 'ask' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${BUTTON} border-accent bg-accent text-white active:bg-accent-hover`} onClick={checkLiterature}>
            Yes
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              dismissLiteratureFor(templateId);
              setPhase('hidden');
            }}
          >
            No thanks
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              optOutOfLiterature();
              setPhase('hidden');
            }}
          >
            Don’t ask again
          </button>
        </div>
      )}

      {phase ==='loading' && <p className="text-base text-text-muted">Searching recent sources…</p>}

      {phase === 'error' && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-base text-text">
            {error}
          </p>
          <div>
            <button type="button" className={BUTTON} onClick={() => setPhase('hidden')}>
              Close
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="flex flex-col gap-3">
          {result.summary && <p className="text-base text-text">{result.summary}</p>}
          {result.suggestions.length === 0 && (
            <p className="text-base text-text">No credible recent sources suggested a change.</p>
          )}
          {result.suggestions.map((s, i) => {
            const isAdded = added.includes(i);
            return (
              <article key={`${s.title}-${i}`} className="rounded-xl border border-border bg-surface shadow-card p-4">
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-base">
                  <span className="font-medium">Change:</span> {s.change}
                </p>
                <p className="mt-1 text-base text-text-muted">
                  <span className="font-medium">Why:</span> {s.rationale}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
                  {s.citations.map((c) => (
                    <li key={c.url}>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-accent-text underline">
                        {c.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={isAdded}
                    onClick={() => {
                      onAddNote(literatureNoteText(s, new Date()));
                      setAdded((prev) => [...prev, i]);
                    }}
                  >
                    {isAdded ? 'Added as note' : 'Add as note to protocol'}
                  </button>
                </div>
              </article>
            );
          })}
          <p className="text-sm text-text-muted">Suggestions are not applied to the steps. Adding one only saves a note.</p>
          <div>
            <button type="button" className={BUTTON} onClick={() => setPhase('hidden')}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
