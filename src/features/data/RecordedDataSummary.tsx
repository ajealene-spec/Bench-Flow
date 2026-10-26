import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { getProcedureForExperiment, listStepRecords } from '../../db/helpers';
import { BUTTON_SECONDARY } from './fieldStyles';
import { groupRecordsByStep, SUMMARY_HEADERS, summaryRows, toCSV, toTSV } from './summary';

/** Every number and timer record for an experiment, grouped by step in procedure order. */
export function RecordedDataSummary({ experimentId, experimentName }: { experimentId: string; experimentName: string }) {
  const data = useLiveQuery(
    async () => {
      const [procedure, records] = await Promise.all([
        getProcedureForExperiment(experimentId, db),
        listStepRecords(experimentId, db),
      ]);
      return { procedure, records };
    },
    [experimentId],
  );
  const [status, setStatus] = useState<string | undefined>(undefined);

  if (!data) return <p className="text-slate-600 dark:text-slate-400">Loading recorded data…</p>;

  const groups = groupRecordsByStep(data.procedure, data.records);
  const rows = summaryRows(groups);

  async function copyTable() {
    try {
      await navigator.clipboard.writeText(toTSV(SUMMARY_HEADERS, rows));
      setStatus('Copied. Paste into Excel or Sheets.');
    } catch {
      setStatus('Copy failed. Your browser blocked the clipboard.');
    }
  }

  function downloadCsv() {
    // The byte order mark lets Excel read µ and other non-ASCII characters correctly.
    const blob = new Blob(['﻿' + toCSV(SUMMARY_HEADERS, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(experimentName)}-recorded-data.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('CSV downloaded.');
  }

  return (
    <section id="recorded-data" aria-label="Recorded data" className="flex flex-col gap-4 rounded-2xl border border-slate-300 p-5 dark:border-slate-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Recorded data</h2>
        <p className="text-base text-slate-600 dark:text-slate-400">
          {rows.length === 0
            ? 'No numbers or timer records yet.'
            : `${rows.length} record${rows.length === 1 ? '' : 's'} across ${groups.length} step${groups.length === 1 ? '' : 's'}.`}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BUTTON_SECONDARY} onClick={() => void copyTable()}>
            Copy as table
          </button>
          <button type="button" className={BUTTON_SECONDARY} onClick={downloadCsv}>
            Download CSV
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="text-base text-slate-700 dark:text-slate-300">
          {status}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.stepId} className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">
            {group.stepNumber !== undefined ? `${group.stepNumber}. ` : ''}
            {group.stepTitle}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-slate-300 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400">
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Label</th>
                  <th className="px-2 py-2 font-medium">Value</th>
                  <th className="px-2 py-2 font-medium">Unit</th>
                  <th className="px-2 py-2 font-medium">Elapsed</th>
                  <th className="px-2 py-2 font-medium">Recorded at</th>
                  <th className="px-2 py-2 font-medium">Started</th>
                  <th className="px-2 py-2 font-medium">Stopped</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows([group]).map((row, i) => (
                  <tr key={i} className="border-b border-slate-200 dark:border-slate-800">
                    <td className="px-2 py-2">{row[2]}</td>
                    <td className="px-2 py-2">{row[3]}</td>
                    <td className="px-2 py-2 font-mono tabular-nums">{row[4]}</td>
                    <td className="px-2 py-2">{row[5]}</td>
                    <td className="px-2 py-2 font-mono tabular-nums">{row[6]}</td>
                    <td className="px-2 py-2 text-sm">{row[8]}</td>
                    <td className="px-2 py-2 text-sm">{row[9]}</td>
                    <td className="px-2 py-2 text-sm">{row[10]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

function slugify(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'experiment';
}
