import { useEffect, useState } from 'react';
import { db } from '../../db';
import { getExperiment, updateExperiment } from '../../db/helpers';
import { appendNote, troubleshootNoteText } from './assistNotes';
import { PRESETS, presetLabel, type PresetId, type TroubleshootResult } from './assistPrompts';
import { fetchAssistConfigured, requestTroubleshoot } from './assistApi';
import { offlineTroubleshoot } from './offlineTips';
import { loadRunReport } from './loadRunReport';
import { compactRunSummary } from './runSummary';

const BUTTON =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-medium text-slate-900 active:bg-slate-100 disabled:opacity-50';
const CHIP =
  'min-h-12 rounded-full border px-4 text-base font-medium active:bg-slate-100';

interface Outcome {
  source: 'ai' | 'offline';
  result: TroubleshootResult;
  note?: string;
  symptom?: string;
  problemText: string;
}

/** "Report a result problem": symptom chips and free text. Gives AI suggestions for this run, or offline tips. */
export function TroubleshootPanel({ experimentId }: { experimentId: string }) {
  const [presetId, setPresetId] = useState<PresetId | undefined>();
  const [text, setText] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    void fetchAssistConfigured().then((ok) => {
      if (alive) setConfigured(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  function offlineOutcome(note: string, problemText: string): Outcome {
    return {
      source: 'offline',
      result: offlineTroubleshoot(presetId),
      note,
      symptom: presetLabel(presetId),
      problemText,
    };
  }

  async function getSuggestions() {
    const problemText = text.trim();
    if (!presetId && !problemText) {
      setMessage('Pick a symptom or describe the problem first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (!configured || !navigator.onLine) {
        setOutcome(offlineOutcome('Offline tips. Connect to the internet with an API key for suggestions based on this run.', problemText));
        return;
      }
      const report = await loadRunReport(experimentId, db);
      if (!report) {
        setMessage('Experiment not found.');
        return;
      }
      const res = await requestTroubleshoot({
        protocolTitle: report.protocol.title,
        problem: { preset: presetId, text: problemText || undefined },
        report: compactRunSummary(report),
      });
      if (res.ok) {
        setOutcome({ source: 'ai', result: res.value, symptom: presetLabel(presetId), problemText });
      } else {
        setOutcome(offlineOutcome(`AI suggestions were unavailable (${res.error}). Showing offline tips.`, problemText));
      }
    } catch {
      setMessage('Could not load this run. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveToNotes() {
    if (!outcome) return;
    try {
      const experiment = await getExperiment(experimentId, db);
      if (!experiment) {
        setMessage('Experiment not found.');
        return;
      }
      const entry = troubleshootNoteText(outcome.result, {
        symptom: outcome.symptom,
        problemText: outcome.problemText || undefined,
        when: new Date(),
      });
      await updateExperiment(experimentId, { notes: appendNote(experiment.notes, entry) }, db);
      setMessage('Saved to notes.');
    } catch {
      setMessage('Could not save to notes. Try again.');
    }
  }

  return (
    <section aria-labelledby="troubleshoot-heading" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 id="troubleshoot-heading" className="text-xl font-semibold">Report a result problem</h2>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Symptom">
        {PRESETS.map((p) => {
          const selected = presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPresetId(selected ? undefined : p.id)}
              className={`${CHIP} ${selected ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-900'}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1 text-base">
        <span className="font-medium">Describe what you saw (optional)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={3}
          className="rounded-xl border border-slate-300 p-3 text-base"
          placeholder="For example: bands are fine but the background is grey across the whole membrane"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${BUTTON} bg-teal-700 text-white active:bg-teal-800`} onClick={getSuggestions} disabled={busy}>
          {busy ? 'Working…' : 'Get suggestions'}
        </button>
        <p className="text-sm text-slate-600">
          {configured === false ? 'Offline tips only (no API key or no server).' : 'Suggestions use this run’s recorded parameters.'}
        </p>
      </div>

      {outcome && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-slate-700">
            {outcome.source === 'ai' ? 'AI suggestions, ranked' : 'Offline tips, ranked'}
          </p>
          {outcome.note && <p className="text-sm text-slate-600">{outcome.note}</p>}
          {outcome.result.causes.map((cause, i) => (
            <article key={`${cause.cause}-${i}`} className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-lg font-semibold">
                {i + 1}. {cause.cause}
              </h3>
              {cause.evidence && <p className="mt-1 text-base text-slate-700">{cause.evidence}</p>}
              {cause.adjustments.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
                  {cause.adjustments.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
          {outcome.result.quickChecks.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="text-lg font-semibold">Quick checks</h3>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
                {outcome.result.quickChecks.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <button type="button" className={BUTTON} onClick={saveToNotes}>
              Save to notes
            </button>
          </div>
        </div>
      )}

      <p role="status" className="text-sm text-slate-600">
        {message}
      </p>
    </section>
  );
}
