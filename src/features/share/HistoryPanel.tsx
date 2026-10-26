import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listProtocolVersions } from '../../db/protocolVersions';
import type { ProtocolTemplate, ProtocolVersion, Step } from '../../types';
import { formatTimestamp } from '../data/time';
import { diffSteps, summarizeStepDiff, type StepDiffRow, type WordSegment } from './diff';
import { restoreVersion, saveVersionWithNote } from './versionHistory';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_SECONDARY =`${BUTTON} border border-border bg-surface shadow-card text-text active:bg-surface-2`;
const INPUT =
'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';

type ViewMode = 'inline' | 'side';

/** Version list, restore, and a diff between any two versions. */
export function HistoryPanel({ template }: { template: ProtocolTemplate }) {
  const versions = useLiveQuery(() => listProtocolVersions(template.id, db), [template.id]);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [newerId, setNewerId] = useState<string>('');
  const [olderId, setOlderId] = useState<string>('');
  const [mode, setMode] = useState<ViewMode>('inline');

  const sorted = useMemo(() => [...(versions ?? [])].sort((a, b) => b.version - a.version), [versions]);
  if (versions === undefined) return <p className="text-text-muted">Loading history…</p>;

  const newer = sorted.find((v) => v.id === newerId) ?? sorted[0];
  const older = sorted.find((v) => v.id === olderId) ?? sorted[1];

  async function saveNow() {
    setMessage(null);
    const result = await saveVersionWithNote(template.id, note, db);
    setMessage(
      result === 'created'
        ? 'Saved a new version.'
        : result === 'noted'
          ? 'Added the note to the latest version.'
          : 'Nothing to save. Make a change first, or type a note on a changed protocol.',
    );
    if (result !== 'nothing') setNote('');
  }

  async function restore(version: ProtocolVersion) {
    const ok = window.confirm(
      `Restore version ${version.version}? This becomes a new version, so nothing is lost. The page will reload to show it.`,
    );
    if (!ok) return;
    try {
      const changed = await restoreVersion(template.id, version.id, db);
      if (!changed) {
        setMessage('The protocol already matches that version.');
        return;
      }
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not restore that version.');
    }
  }

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-4">
      <h2 id="history-heading" className="text-xl font-semibold">
        History
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm text-text-muted">Note for a new version (optional)</span>
          <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: 2 h incubation" />
        </label>
        <div className="flex items-end">
          <button type="button" className={BUTTON_SECONDARY} onClick={() => void saveNow()}>
            Save version now
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="text-sm text-text-muted">
          {message}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-text-muted">No versions yet. A version is saved after each change.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {sorted.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="flex flex-col">
                <span className="font-medium">
                  Version {v.version}
                  {v.version === sorted[0].version ? ' (latest)' : ''}
                </span>
                <span className="text-sm text-text-muted">
                  {formatTimestamp(v.createdAt)}
                  {v.note ? ` · ${v.note}` : ''}
                </span>
              </div>
              <button type="button" className={BUTTON_SECONDARY} onClick={() => void restore(v)}>
                Restore
              </button>
            </li>
          ))}
        </ol>
      )}

      {sorted.length >= 2 && newer && older && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-text-muted">Newer version</span>
              <select className={INPUT} value={newer.id} onChange={(e) => setNewerId(e.target.value)}>
                {sorted.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.version}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-text-muted">Older version</span>
              <select className={INPUT} value={older.id} onChange={(e) => setOlderId(e.target.value)}>
                {sorted.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.version}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div role="group" aria-label="Diff layout" className="flex gap-2">
            <button type="button" className={mode === 'inline' ? BUTTON : BUTTON_SECONDARY} aria-pressed={mode === 'inline'} onClick={() => setMode('inline')}>
              Inline
            </button>
            <button type="button" className={mode === 'side' ? BUTTON : BUTTON_SECONDARY} aria-pressed={mode === 'side'} onClick={() => setMode('side')}>
              Side by side
            </button>
          </div>
          <StepDiff older={older} newer={newer} mode={mode} />
        </div>
      )}
    </section>
  );
}

/** Diff of the step lists of two versions, with word-level highlights inside changed steps. */
export function StepDiff({ older, newer, mode }: { older: ProtocolVersion; newer: ProtocolVersion; mode: ViewMode }) {
  const rows = diffSteps(older.snapshot.steps as Step[], newer.snapshot.steps as Step[]);
  const counts = summarizeStepDiff(rows);
  const titleChanged = older.snapshot.title !== newer.snapshot.title;
  const noChanges = rows.every((r) => r.kind === 'unchanged') && !titleChanged;

  return (
    <div className="flex flex-col gap-3" aria-label={`Changes from version ${older.version} to ${newer.version}`}>
      <p className="text-sm text-text-muted">
        {noChanges
          ? 'No step changes between these versions.'
          : `${counts.added} added, ${counts.removed} removed, ${counts.changed} changed, ${counts.unchanged} unchanged.`}
        {titleChanged ? ` Title: “${older.snapshot.title}” to “${newer.snapshot.title}”.` : ''}
      </p>
      {mode === 'inline' ? <InlineRows rows={rows} /> : <SideRows rows={rows} />}
    </div>
  );
}

/** Renders word segments. Callers pass only the segments that belong on their side. */
function Segments({ segments }: { segments: WordSegment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'equal') return <span key={i}>{s.text}</span>;
        return s.type === 'added' ? (
          <ins key={i} className="rounded bg-emerald-200 px-0.5 no-underline dark:bg-emerald-800 dark:text-emerald-50">
            {s.text}
          </ins>
        ) : (
          <del key={i} className="rounded bg-rose-200 px-0.5 dark:bg-rose-900 dark:text-rose-50">
            {s.text}
          </del>
        );
      })}
    </>
  );
}

const KIND_LABEL: Record<StepDiffRow['kind'], string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  unchanged: 'Unchanged',
};

const KIND_CLASS: Record<StepDiffRow['kind'], string> = {
  added: 'border-emerald-500',
  removed: 'border-rose-500',
  changed: 'border-amber-500',
  unchanged:'border-border',
};

function InlineRows({ rows }: { rows: StepDiffRow[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const step = row.after ?? row.before;
        if (!step) return null;
        return (
          <li key={i} className={`flex flex-col gap-1 rounded-xl border-l-4 bg-surface shadow-card p-3 text-base  ${KIND_CLASS[row.kind]}`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              {KIND_LABEL[row.kind]}
              {row.kind === 'changed' && row.fields.length > 0 ? ` · ${row.fields.join(', ')}` : ''}
            </p>
            {row.kind === 'changed' && row.titleWords && (
              <p className="font-semibold">
                <Segments segments={row.titleWords} />
              </p>
            )}
            {row.kind === 'changed' && row.instructionWords ? (
              <p className="whitespace-pre-line">
                <Segments segments={row.instructionWords} />
              </p>
            ) : (
              <>
                <p className={row.kind === 'removed' ? 'font-semibold line-through' : 'font-semibold'}>{step.title}</p>
                {step.instructions && <p className="whitespace-pre-line">{step.instructions}</p>}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SideRows({ rows }: { rows: StepDiffRow[] }) {
  return (
    <div aria-label="Side by side step changes" className="grid grid-cols-1 gap-2 text-base sm:grid-cols-2">
      <div className="text-sm font-semibold text-text-muted  sm:col-start-1">
        Older
      </div>
      <div className="text-sm font-semibold text-text-muted  sm:col-start-2">
        Newer
      </div>
      {rows.map((row, i) => {
        const left = row.before;
        const right = row.after;
        const leftSegments = row.kind === 'changed' ? row.instructionWords?.filter((s) => s.type !== 'added') : undefined;
        const rightSegments = row.kind === 'changed' ? row.instructionWords?.filter((s) => s.type !== 'removed') : undefined;
        return (
          <div key={i} className="contents">
            <div className={`rounded-xl border-l-4 bg-surface shadow-card p-3  ${KIND_CLASS[row.kind]} ${right ?'' :'opacity-40'}`}>
              {left ? (
                <>
                  <p className="font-semibold">{left.title}</p>
                  <p className="whitespace-pre-line">
                    {leftSegments ? <Segments segments={leftSegments} /> : left.instructions}
                  </p>
                </>
              ) : (
                <p className="text-text-muted">—</p>
              )}
            </div>
            <div className={`rounded-xl border-l-4 bg-surface shadow-card p-3  ${KIND_CLASS[row.kind]} ${left ?'' :'opacity-40'}`}>
              {right ? (
                <>
                  <p className="font-semibold">{right.title}</p>
                  <p className="whitespace-pre-line">
                    {rightSegments ? <Segments segments={rightSegments} /> : right.instructions}
                  </p>
                </>
              ) : (
                <p className="text-text-muted">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
