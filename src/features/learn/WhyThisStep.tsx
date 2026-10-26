import { useEffect, useState } from 'react';
import { getExplanation, putExplanation } from '../../db/explanations';
import { db } from '../../db';
import { API_KEY_HEADER, apiKeyHeaders } from '../../app/apiKey';
import { requestExplanation } from '../assist/assistApi';
import type { ExplanationLink, Step } from '../../types';
import { genericOrFallback, learnMoreLinks, toStepExplanation } from './explanations';
import { useIsBeginner } from './useLearnData';

interface Shown {
  why: string;
  mistakes: string[];
  links: ExplanationLink[];
  source: 'saved' | 'ai' | 'offline';
}

/** Expandable "Why this step?" panel. Open by default in beginner mode, collapsed in advanced mode. */
export function WhyThisStep({ step }: { step: Step }) {
  const beginner = useIsBeginner();
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const isOpen = expanded ?? beginner;
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getExplanation(step.id, db).catch(() => undefined);
      if (cached) {
        if (!cancelled) setShown({ why: cached.why, mistakes: cached.mistakes, links: cached.links, source: 'saved' });
        return;
      }
      const generic = genericOrFallback(step.title, step.instructions);
      if (!cancelled) setShown({ why: generic.why, mistakes: generic.mistakes, links: generic.links, source: 'offline' });
      if (!navigator.onLine) return;
      const headers = await apiKeyHeaders(db);
      if (!headers[API_KEY_HEADER]) return;
      const res = await requestExplanation({ stepId: step.id, title: step.title, instructions: step.instructions });
      if (!res.ok || cancelled) return;
      const links = learnMoreLinks(generic.keyword === 'general' ? step.title : generic.keyword);
      await putExplanation(toStepExplanation(step.id, res.value.why, res.value.mistakes, links), db).catch(() => undefined);
      if (!cancelled) setShown({ why: res.value.why, mistakes: res.value.mistakes, links, source: 'ai' });
    })();
    return () => {
      cancelled = true;
    };
  }, [step.id, step.title, step.instructions]);

  return (
    <section aria-label="Why this step" className="rounded-2xl border border-border">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setExpanded(!isOpen)}
        className="flex min-h-12 w-full items-center justify-between px-4 text-left text-lg font-semibold"
      >
        Why this step?
        <span className="text-base font-medium text-text-muted">{isOpen ?'Hide' :'Show'}</span>
      </button>
      {isOpen && shown && (
        <div className="flex flex-col gap-4 border-t border-border p-4 text-lg">
          <p className="leading-relaxed">{shown.why}</p>
          {shown.mistakes.length > 0 && (
            <div aria-label="Common mistakes" className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="mb-2 font-semibold">Common mistakes</h3>
              <ul className="list-disc pl-6 text-base leading-relaxed">
                {shown.mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {shown.links.length > 0 && (
            <nav aria-label="Learn more" className="flex flex-col gap-1">
              <h3 className="font-semibold">Learn more</h3>
              <ul className="flex flex-col">
                {shown.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center underline underline-offset-4"
                    >
                      {l.title} (opens in a new tab)
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <p className="text-sm text-text-muted">
            {shown.source === 'ai' ? 'Written by AI and saved for this step.' : shown.source === 'saved' ? 'Saved for this step.' : 'General notes. AI explanations need an online connection and a saved key.'}
          </p>
        </div>
      )}
    </section>
  );
}
