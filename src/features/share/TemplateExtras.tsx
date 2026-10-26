import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listComments } from '../../db/comments';
import { listProtocolVersions } from '../../db/protocolVersions';
import type { ProtocolTemplate } from '../../types';
import { buildBenchflowPayload } from './benchflowFile';
import { CommentThread } from './CommentThread';
import { HistoryPanel } from './HistoryPanel';
import { LICENSE_OPTIONS, licenseOption } from './license';
import { installVersionHistory } from './versionHistory';
import { ShareProtocolPanel } from './ShareProtocolPanel';

const INPUT =
'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';

/**
 * The sharing, credit, history and comment sections of a template page. Mounted once on the template page;
 * it saves only the fields it owns (license, authors) and leaves the editor's fields alone.
 */
export function TemplateExtras({ template }: { template: ProtocolTemplate }) {
  useEffect(() => {
    installVersionHistory(db);
  }, []);

  const comments = useLiveQuery(async () => {
    const stepIds = template.steps.map((s) => s.id);
    const all = await listComments(undefined, db);
    return all.filter(
      (c) => (c.targetType === 'template' && c.targetId === template.id) || (c.targetType === 'step' && stepIds.includes(c.targetId)),
    );
  }, [template.id, template.steps]);
  const versions = useLiveQuery(() => listProtocolVersions(template.id, db), [template.id]);
  const latestVersion = Math.max(1, ...(versions ?? []).map((v) => v.version));

  return (
    <div className="flex flex-col gap-8">
      <CreditBlock template={template} />

      <section aria-labelledby="license-heading" className="flex flex-col gap-3">
        <h2 id="license-heading" className="text-xl font-semibold">
          Authors and license
        </h2>
        <AuthorsAndLicense template={template} />
      </section>

      <ShareProtocolPanel
        payload={buildBenchflowPayload({ template, version: latestVersion, comments: comments ?? [] })}
      />

      <HistoryPanel template={template} />

      <section aria-labelledby="comments-heading" className="flex flex-col gap-4">
        <h2 id="comments-heading" className="text-xl font-semibold">
          Comments
        </h2>
        <CommentThread targetType="template" targetId={template.id} label="this protocol" />
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">Step comments</h3>
          {template.steps.length === 0 && <p className="text-sm text-text-muted">Add steps to comment on them.</p>}
          {template.steps.map((step, i) => {
            const count = (comments ?? []).filter((c) => c.targetType === 'step' && c.targetId === step.id).length;
            const open = (comments ?? []).filter((c) => c.targetType === 'step' && c.targetId === step.id && !c.resolved).length;
            return (
              <details key={step.id} className="rounded-xl border border-border p-3">
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-base font-medium">
                  <span>
                    {i + 1}. {step.title || 'Untitled step'}
                  </span>
                  {count > 0 && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-sm text-text">
                      {count}
                      {open > 0 && open !== count ? ` · ${open} open` : ''}
                    </span>
                  )}
                </summary>
                <div className="mt-3">
                  <CommentThread targetType="step" targetId={step.id} label={`step ${i + 1}`} />
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** "Copied from …" badge with a link back to the original, when this protocol was copied with credit. */
function CreditBlock({ template }: { template: ProtocolTemplate }) {
  const source = template.forkedFrom;
  if (!source) return null;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-sm" data-testid="fork-badge">
      <p>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-text">Copied from</span>{''}
        <strong>{source.title}</strong>
        {source.author ? ` by ${source.author}` : ''}
      </p>
      {source.url && (
        <a href={source.url} className="break-all text-accent-text underline">
          Open the original
        </a>
      )}
      {source.doi && <p className="break-all">DOI: {source.doi}</p>}
    </div>
  );
}

function AuthorsAndLicense({ template }: { template: ProtocolTemplate }) {
  const [authors, setAuthors] = useState((template.authors ?? []).join(', '));
  const license = licenseOption(template.license);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Authors</span>
        <input
          className={INPUT}
          value={authors}
          onChange={(e) => setAuthors(e.target.value)}
          onBlur={() =>
            void db.templates.update(template.id, {
              authors: authors
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean),
              updatedAt: Date.now(),
            })
          }
          placeholder="Ana Lee, Ben Ko"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">License</span>
        <select
          className={INPUT}
          value={license.id}
          onChange={(e) => void db.templates.update(template.id, { license: e.target.value, updatedAt: Date.now() })}
        >
          {LICENSE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-text-muted">{license.statement}</p>
    </div>
  );
}
