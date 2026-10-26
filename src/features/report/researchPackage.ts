import type { Experiment, ExecutionEvent, Procedure, ProtocolTemplate, StepRecord } from '../../types';
import { DEFAULT_LICENSE } from '../share/benchflowFile';
import { licenseOption } from '../share/license';
import type { ExecutionLog } from './buildExecutionLog';
import type { Report } from './buildReport';
import { reportToCSV, reportToEventsCSV } from './reportText';
import type { ZipEntry } from './zip';

export const PACKAGE_SCHEMA = 'lab-companion-research-package/1';

export interface PackageReagent {
  name: string;
  kind?: string;
  vendor?: string;
  catalogNumber?: string;
  lotNumber?: string;
  expiresOn?: string;
  /** Research Resource Identifier found in the item's name or notes, for example "RRID:AB_2298772". */
  rrid?: string;
  /** Steps (1-based) the item was linked to. */
  stepNumbers: number[];
}

export interface PackagePhoto {
  id: string;
  at: number;
  caption: string;
  stepNumber?: number;
  mimeType: string;
  bytes: Uint8Array;
  annotations: string[];
}

export interface ResearchPackageInput {
  experiment: Experiment;
  report: Report;
  executionLog: ExecutionLog;
  events: ExecutionEvent[];
  procedure?: Procedure;
  template?: ProtocolTemplate | null;
  records: StepRecord[];
  reagents: PackageReagent[];
  photos: PackagePhoto[];
  /** Names for the creators field. Protocol authors are used when none are given. */
  creators?: string[];
  generatedAt: number;
}

/** Matches RRID:AB_2338840 and RRID:SCR_002285 style identifiers. */
const RRID_PATTERN = /RRID:[A-Za-z0-9_]+(?::[A-Za-z0-9_.-]+)?/i;

/** Finds an RRID in free text, so an antibody's RRID can be recorded without a dedicated field. */
export function findRrid(...texts: Array<string | undefined>): string | undefined {
  for (const text of texts) {
    const match = text?.match(RRID_PATTERN);
    if (match) return match[0].replace(/^rrid/i, 'RRID');
  }
  return undefined;
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function extensionFor(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
}

/** Protocol as Markdown: overview, materials, phases and numbered steps. */
export function protocolToMarkdown(title: string, procedure: Procedure | undefined, template?: ProtocolTemplate | null): string {
  const lines: string[] = [`# ${title}`, ''];
  const overview = procedure?.overview ?? template?.overview;
  if (overview) {
    lines.push('## Overview', '');
    if (overview.objective) lines.push(`- Objective: ${overview.objective}`);
    if (overview.totalTime) lines.push(`- Total time: ${overview.totalTime}`);
    if (overview.outputs) lines.push(`- Outputs: ${overview.outputs}`);
    lines.push('');
  }
  const materials = procedure?.materials ?? template?.materials ?? [];
  if (materials.length > 0) {
    lines.push('## Materials', '');
    for (const m of materials) lines.push(`- ${m.name} (${m.kind})`);
    lines.push('');
  }
  const steps = procedure?.steps ?? template?.steps ?? [];
  const phases = procedure?.phases ?? template?.phases ?? [];
  lines.push('## Steps', '');
  steps.forEach((step, i) => {
    const phase = phases.find((p) => p.id === step.phaseId);
    if (phase) lines.push(`_Phase: ${phase.name}_`, '');
    lines.push(`${i + 1}. **${step.title}**`);
    if (step.instructions) lines.push('', `   ${step.instructions.replace(/\n/g, '\n   ')}`);
    for (const r of step.reagents) lines.push(`   - Reagent: ${[r.name, r.amount, r.unit].filter(Boolean).join(' ')}`);
    for (const t of step.timers) lines.push(`   - Timer: ${t.label}, ${Math.round(t.durationSec / 60)} min`);
    for (const c of step.cautions) lines.push(`   - Caution: ${c}`);
    lines.push('');
  });
  return lines.join('\n');
}

/** Plain-language README that tells a future reader what is in the package. */
function readme(input: ResearchPackageInput, title: string): string {
  const { report } = input;
  return [
    `# Research package: ${title}`,
    '',
    `Exported by Bench Flow on ${new Date(input.generatedAt).toISOString()}.`,
    '',
    '## Contents',
    '',
    '- protocol.json and protocol.md: the protocol this run followed (the snapshot taken when the run started).',
    '- execution-log.json: what happened, in order, with pauses and deviations. Also methods.txt.',
    '- events.csv: every logged event with its time, planned and actual values.',
    '- recorded-data.csv: numbers and timers recorded per step.',
    '- reagents.csv: reagents and antibodies used, with lot, catalog number and RRID where known.',
    '- photos/: photos taken during the run, with photos/index.csv describing each one.',
    '- methods.txt: a past-tense Methods paragraph built from the log.',
    '- metadata.json: DataCite-style description of the record (title, creators, dates, license, keywords, related identifiers).',
    '- .zenodo.json: the same description in Zenodo deposit form, for reference when you upload.',
    '',
    '## Summary',
    '',
    `- Status: ${report.status.replace('_', ' ')}`,
    `- Started: ${report.dates.startedAt ? new Date(report.dates.startedAt).toISOString() : 'not recorded'}`,
    `- Ended: ${report.dates.endedAt ? new Date(report.dates.endedAt).toISOString() : 'not recorded'}`,
    `- Recorded entries: ${report.recordCount}`,
    `- Deviations logged: ${input.executionLog.deviations.length}`,
    '',
    '## Reuse',
    '',
    `License: ${licenseOption(input.template?.license ?? DEFAULT_LICENSE).statement}`,
    '',
  ].join('\n');
}

/** Builds the files of a FAIR-style research package. Pure: the caller loads the data and zips the result. */
export function buildResearchPackage(input: ResearchPackageInput): ZipEntry[] {
  const { experiment, executionLog, events, procedure, template, records } = input;
  const title = experiment.name;
  const license = licenseOption(template?.license ?? DEFAULT_LICENSE);
  const creators = input.creators && input.creators.length > 0 ? input.creators : template?.authors?.length ? template.authors : ['Unknown'];
  const protocolTitle = procedure?.title ?? template?.title ?? 'Unknown protocol';
  const keywords = [...new Set([template?.category, 'laboratory protocol', 'experiment record'].filter((k): k is string => !!k))];

  const protocolJson = {
    title: protocolTitle,
    category: template?.category,
    overview: procedure?.overview ?? template?.overview,
    materials: procedure?.materials ?? template?.materials ?? [],
    phases: procedure?.phases ?? template?.phases ?? [],
    steps: procedure?.steps ?? template?.steps ?? [],
    license: template?.license ?? DEFAULT_LICENSE,
    authors: template?.authors ?? [],
    forkedFrom: template?.forkedFrom,
  };

  const relatedIdentifiers: Array<{ relatedIdentifier: string; relatedIdentifierType: string; relationType: string }> = [];
  if (template?.forkedFrom?.doi) {
    relatedIdentifiers.push({ relatedIdentifier: template.forkedFrom.doi, relatedIdentifierType: 'DOI', relationType: 'IsDerivedFrom' });
  }
  if (template?.forkedFrom?.url) {
    relatedIdentifiers.push({ relatedIdentifier: template.forkedFrom.url, relatedIdentifierType: 'URL', relationType: 'IsDerivedFrom' });
  }

  const dates: Array<{ date: string; dateType: string; dateInformation?: string }> = [
    { date: new Date(experiment.createdAt).toISOString(), dateType: 'Created' },
  ];
  if (experiment.startedAt !== undefined && experiment.endedAt !== undefined) {
    dates.push({
      date: `${new Date(experiment.startedAt).toISOString()}/${new Date(experiment.endedAt).toISOString()}`,
      dateType: 'Collected',
    });
  }

  const description = `Record of a laboratory run of "${protocolTitle}" (${input.report.status.replace('_', ' ')}), with protocol, execution log, recorded data, reagents and photos.`;

  const metadata = {
    schema: PACKAGE_SCHEMA,
    identifier: { identifier: experiment.id, identifierType: 'UUID' },
    titles: [{ title }],
    title,
    creators: creators.map((name) => ({ name, nameType: 'Personal' })),
    publisher: 'Bench Flow (local export)',
    publicationYear: new Date(input.generatedAt).getUTCFullYear(),
    resourceType: { resourceTypeGeneral: 'Dataset', resourceType: 'Laboratory run record' },
    dates,
    rightsList: [
      {
        rights: license.statement,
        ...(license.zenodoId ? { rightsIdentifier: license.id, rightsIdentifierScheme: 'SPDX' } : {}),
      },
    ],
    keywords,
    subjects: keywords.map((subject) => ({ subject })),
    descriptions: [{ description, descriptionType: 'Abstract' }],
    relatedIdentifiers,
    version: '1',
    language: 'en',
  };

  const zenodo: Record<string, unknown> = {
    title,
    upload_type: 'dataset',
    description,
    creators: creators.map((name) => ({ name })),
    keywords,
    version: '1',
    access_right: license.zenodoId ? 'open' : 'closed',
    related_identifiers: relatedIdentifiers.map((r) => ({
      identifier: r.relatedIdentifier,
      relation: 'isDerivedFrom',
      scheme: r.relatedIdentifierType === 'DOI' ? 'doi' : 'url',
    })),
  };
  if (license.zenodoId) zenodo.license = license.zenodoId;

  const reagentRows = input.reagents.map((r) => [
    r.name,
    r.kind ?? '',
    r.vendor ?? '',
    r.catalogNumber ?? '',
    r.lotNumber ?? '',
    r.expiresOn ?? '',
    r.rrid ?? '',
    r.stepNumbers.join(' '),
  ]);

  const photoRows = input.photos.map((p, i) => {
    const name = `photos/photo-${String(i + 1).padStart(2, '0')}.${extensionFor(p.mimeType)}`;
    return { name, row: [name, new Date(p.at).toISOString(), p.stepNumber ?? '', p.caption, p.annotations.join('; ')] };
  });

  const files: ZipEntry[] = [
    { path: 'README.md', data: readme(input, title) },
    { path: 'protocol.json', data: JSON.stringify(protocolJson, null, 2) },
    { path: 'protocol.md', data: protocolToMarkdown(protocolTitle, procedure, template) },
    { path: 'execution-log.json', data: JSON.stringify(executionLog, null, 2) },
    { path: 'events.csv', data: reportToEventsCSV(events) },
    { path: 'recorded-data.csv', data: reportToCSV(procedure, records) },
    {
      path: 'reagents.csv',
      data: csv(['Name', 'Kind', 'Vendor', 'Catalog number', 'Lot number', 'Expires', 'RRID', 'Steps'], reagentRows),
    },
    { path: 'methods.txt', data: executionLog.methodsText || 'No steps were performed, so there is no Methods text.' },
    { path: 'metadata.json', data: JSON.stringify(metadata, null, 2) },
    { path: '.zenodo.json', data: JSON.stringify(zenodo, null, 2) },
  ];

  if (photoRows.length > 0) {
    files.push({ path: 'photos/index.csv', data: csv(['File', 'Taken at', 'Step', 'Caption', 'Annotations'], photoRows.map((p) => p.row)) });
    input.photos.forEach((photo, i) => {
      files.push({ path: photoRows[i].name, data: photo.bytes });
    });
  }
  return files;
}
