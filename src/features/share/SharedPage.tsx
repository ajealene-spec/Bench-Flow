import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BenchflowPayload } from './benchflowFile';
import { licenseOption } from './license';
import { copyWithCredit } from './library';
import { decodeSharePayload, readShareHash } from './shareLink';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const SECTION ='mt-6 flex flex-col gap-3 border-t border-border pt-4';

type Loaded = { status: 'loading' } | { status: 'empty' } | { status: 'error'; message: string } | { status: 'ready'; payload: BenchflowPayload };

/**
 * Read-only view of a protocol shared by link. The protocol lives in the URL hash (#d=...), which the
 * browser never sends to a server, so this page needs no backend.
 */
export default function SharedPage() {
  const navigate = useNavigate();
  const [hash, setHash] = useState(() => window.location.hash);
  const [state, setState] = useState<Loaded>({ status: 'loading' });
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const encoded = readShareHash(hash);
    if (!encoded) {
      setState({ status: 'empty' });
      return;
    }
    setState({ status: 'loading' });
    decodeSharePayload(encoded).then(
      (payload) => !cancelled && setState({ status: 'ready', payload }),
      (error: unknown) =>
        !cancelled && setState({ status: 'error', message: error instanceof Error ? error.message : 'This link could not be opened.' }),
    );
    return () => {
      cancelled = true;
    };
  }, [hash]);

  async function copyToLibrary(payload: BenchflowPayload) {
    setCopying(true);
    setCopyError(null);
    try {
      const copy = await copyWithCredit(payload, { sourceUrl: window.location.href });
      navigate(`/library/${copy.id}`);
    } catch {
      setCopyError('Could not copy the protocol to your library. Check that this browser allows storage, then try again.');
    } finally {
      setCopying(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/library" className="inline-flex min-h-12 items-center text-accent-text underline">
          Back to library
        </Link>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-text">
          Read only
        </span>
      </header>

      {state.status ==='loading' && <p className="text-text-muted">Opening shared protocol…</p>}

      {state.status === 'empty' && (
        <section className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">No shared protocol here</h1>
          <p>This page shows protocols shared as a link. Open the link you were sent, or import a .benchflow.json file from the Library.</p>
        </section>
      )}

      {state.status === 'error' && (
        <section className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Could not open this protocol</h1>
          <p role="alert" className="rounded-xl bg-rose-100 p-3 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
            {state.message}
          </p>
        </section>
      )}

      {state.status === 'ready' && (
        <ProtocolView payload={state.payload} copying={copying} copyError={copyError} onCopy={() => void copyToLibrary(state.payload)} />
      )}
    </main>
  );
}

function ProtocolView({
  payload,
  copying,
  copyError,
  onCopy,
}: {
  payload: BenchflowPayload;
  copying: boolean;
  copyError: string | null;
  onCopy: () => void;
}) {
  const { metadata, template } = payload;
  const license = licenseOption(metadata.license);
  const phases = template.phases ?? [];
  const ungrouped = template.steps.filter((s) => !s.phaseId || !phases.some((p) => p.id === s.phaseId));
  // Numbers follow the order of the protocol's steps, whichever phase they sit in.
  const numbered = (steps: typeof template.steps) => steps.map((step) => ({ step, number: template.steps.indexOf(step) + 1 }));

  return (
    <article className="flex flex-col gap-2">
      <p className="text-sm uppercase tracking-wide text-text-muted">Shared protocol · {template.category}</p>
      <h1 className="text-3xl font-semibold leading-tight">{template.title}</h1>
      <p className="text-base text-text-muted">
        {metadata.authors.length > 0 ? `By ${metadata.authors.join(', ')} · ` : ''}
        {license.label} · Version {metadata.version}
      </p>
      {metadata.forkedFrom && (
        <p className="text-sm text-text-muted">
          Copied from {metadata.forkedFrom.title}
          {metadata.forkedFrom.author ? ` by ${metadata.forkedFrom.author}` : ''}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={BUTTON_PRIMARY} disabled={copying} onClick={onCopy}>
          {copying ? 'Copying…' : 'Copy to my library'}
        </button>
      </div>
      <p className="text-sm text-text-muted">
        The copy credits {metadata.title} and keeps its license. Comments are not included in links.
      </p>
      {copyError && (
        <p role="alert" className="text-rose-700 dark:text-rose-300">
          {copyError}
        </p>
      )}

      {template.overview && (
        <section className={SECTION} aria-labelledby="sv-overview">
          <h2 id="sv-overview" className="text-xl font-semibold">
            Overview
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Objective" value={template.overview.objective} />
            <Field label="Total time" value={template.overview.totalTime} />
            <Field label="Outputs" value={template.overview.outputs} />
          </dl>
        </section>
      )}

      {template.materials && template.materials.length > 0 && (
        <section className={SECTION} aria-labelledby="sv-materials">
          <h2 id="sv-materials" className="text-xl font-semibold">
            Materials
          </h2>
          {(['solution', 'consumable', 'equipment'] as const).map((kind) => {
            const items = template.materials!.filter((m) => m.kind === kind);
            if (items.length === 0) return null;
            return (
              <div key={kind}>
                <h3 className="font-medium capitalize">{kind === 'solution' ? 'Solutions and reagents' : kind === 'consumable' ? 'Consumables' : 'Equipment'}</h3>
                <ul className="mt-1 list-disc pl-6">
                  {items.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {template.hazards.length > 0 && (
        <section className={SECTION} aria-labelledby="sv-hazards">
          <h2 id="sv-hazards" className="text-xl font-semibold">
            Hazards
          </h2>
          <ul className="flex flex-col gap-2">
            {template.hazards.map((h) => (
              <li key={h.id} className="rounded-xl border-l-4 border-amber-600 bg-amber-50 p-3 text-text">
                <strong>{h.name}</strong> ({h.kind}): {h.reason}
                {h.ppe.length > 0 && <span> PPE: {h.ppe.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={SECTION} aria-labelledby="sv-steps">
        <h2 id="sv-steps" className="text-xl font-semibold">
          Steps
        </h2>
        {phases.map((phase) => {
          const group = numbered(template.steps.filter((s) => s.phaseId === phase.id));
          return (
            <div key={phase.id} className="flex flex-col gap-3">
              <h3 className="mt-2 text-lg font-semibold text-accent-text dark:text-emerald-300">{phase.name}</h3>
              {group.map(({ step, number: n }) => (
                <StepView key={step.id} step={step} number={n} />
              ))}
            </div>
          );
        })}
        {numbered(ungrouped).map(({ step, number: n }) => (
          <StepView key={step.id} step={step} number={n} />
        ))}
        {template.steps.length === 0 && <p>This protocol has no steps.</p>}
      </section>

      {template.notes && (
        <section className={SECTION} aria-labelledby="sv-notes">
          <h2 id="sv-notes" className="text-xl font-semibold">
            Notes
          </h2>
          <p className="whitespace-pre-line">{template.notes}</p>
        </section>
      )}
    </article>
  );
}

function StepView({ step, number }: { step: BenchflowPayload['template']['steps'][number]; number: number }) {
  return (
    <section className="rounded-xl border border-border p-4" aria-label={`Step ${number}`}>
      <h4 className="text-lg font-semibold">
        {number}. {step.title}
      </h4>
      {step.instructions && <p className="mt-1 whitespace-pre-line text-base leading-relaxed">{step.instructions}</p>}
      {step.cautions.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {step.cautions.map((c) => (
            <li key={c} className="rounded-lg bg-amber-50 px-3 py-1 text-text">
              Caution: {c}
            </li>
          ))}
        </ul>
      )}
      {step.reagents.length > 0 && (
        <p className="mt-2 text-sm text-text-muted">
          Reagents: {step.reagents.map((r) => [r.name, r.amount, r.unit].filter(Boolean).join(' ')).join('; ')}
        </p>
      )}
      {step.timers.length > 0 && (
        <p className="mt-1 text-sm text-text-muted">
          Timers: {step.timers.map((t) => `${t.label} (${Math.round(t.durationSec / 60)} min)`).join('; ')}
        </p>
      )}
      {step.dataFields.length > 0 && (
        <p className="mt-1 text-sm text-text-muted">Record: {step.dataFields.map((f) => f.label).join(',')}</p>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  );
}
