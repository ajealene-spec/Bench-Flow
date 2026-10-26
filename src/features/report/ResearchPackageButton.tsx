import { useState } from 'react';
import type { ReportData } from './reportData';
import { buildResearchPackageZip } from './researchPackageLoader';

const BUTTON_PRIMARY =
  'inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-4 font-medium text-white active:bg-accent-hover';

/** Downloads the FAIR research package (.zip) for one run. */
export function ResearchPackageButton({ experimentId, data }: { experimentId: string; data: ReportData }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function download() {
    setBusy(true);
    setMessage('');
    try {
      const bytes = await buildResearchPackageZip(experimentId, data);
      const name = `${slugify(data.report.title)}-research-package.zip`;
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${name}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not build the research package.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={BUTTON_PRIMARY} disabled={busy} onClick={() => void download()}>
        {busy ? 'Building package…' : 'Download research package (.zip)'}
      </button>
      {message && (
        <p role="status" className="w-full text-sm text-text-muted">
          {message}
        </p>
      )}
    </>
  );
}

function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'experiment';
}
