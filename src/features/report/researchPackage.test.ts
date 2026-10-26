import { describe, expect, it } from 'vitest';
import { buildZip, crc32, dosDateTime } from './zip';
import { buildResearchPackage, findRrid, protocolToMarkdown, type ResearchPackageInput } from './researchPackage';
import type { ExecutionLog } from './buildExecutionLog';
import type { Report } from './buildReport';
import type { Experiment, ProtocolTemplate, Step } from '../../types';

/** Reads back the entries of a stored (uncompressed) zip, checking each CRC. Test-only. */
function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(pos, true)).toBe(0x02014b50);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    const localNameLen = view.getUint16(localOffset + 26, true);
    const dataStart = localOffset + 30 + localNameLen;
    const data = bytes.subarray(dataStart, dataStart + size);
    expect(crc32(data)).toBe(crc);
    out.set(name, new Uint8Array(data));
    pos += 46 + nameLen;
  }
  return out;
}

const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

const steps: Step[] = [
  {
    id: 'st1',
    title: 'Block membrane',
    instructions: 'Incubate in 5% milk for 1 h.',
    timers: [{ id: 't1', stepId: 'st1', label: 'Block', durationSec: 3600, status: 'idle' }],
    reagents: [{ name: 'Milk', amount: '5', unit: '%' }],
    dataFields: [],
    cautions: ['Wear gloves'],
  },
  { id: 'st2', title: 'Image', instructions: 'Scan at 700 nm.', timers: [], reagents: [], dataFields: [], cautions: [] },
];

const experiment: Experiment = {
  id: 'exp-1',
  name: 'Blot 12 March',
  status: 'done',
  folderId: null,
  templateId: 'tpl-1',
  startedAt: Date.UTC(2026, 2, 12, 9),
  endedAt: Date.UTC(2026, 2, 12, 15),
  createdAt: Date.UTC(2026, 2, 11),
  updatedAt: Date.UTC(2026, 2, 12),
};

const template: ProtocolTemplate = {
  id: 'tpl-1',
  title: 'Western blot',
  category: 'Western Blot',
  steps,
  hazards: [],
  authors: ['Ana Lee'],
  license: 'CC-BY-SA-4.0',
  forkedFrom: { title: 'Original blot', author: 'Ben Ko', url: 'https://lab.example/shared#d=x', doi: '10.1234/abcd' },
  createdAt: 1,
  updatedAt: 2,
};

const report = {
  experimentId: 'exp-1',
  title: 'Blot 12 March',
  protocol: { title: 'Western blot', category: 'Western Blot' },
  status: 'done',
  dates: { startedAt: experiment.startedAt, endedAt: experiment.endedAt, durationSec: 21600 },
  safety: { items: [], hazards: [] },
  steps: [],
  notes: '',
  deviations: [],
  reagents: [],
  recordCount: 2,
} as unknown as Report;

const executionLog: ExecutionLog = {
  experimentId: 'exp-1',
  steps: [],
  timeline: [],
  pauses: [],
  deviations: [{ kind: 'timer', message: 'Block ran 10 min long', at: 1 } as never],
  methodsText: 'Membranes were blocked in 5% milk for 1 h.',
};

function input(overrides: Partial<ResearchPackageInput> = {}): ResearchPackageInput {
  return {
    experiment,
    report,
    executionLog,
    events: [],
    procedure: undefined,
    template,
    records: [],
    reagents: [
      {
        name: 'Anti-GAPDH antibody, "clone 6C5"',
        kind: 'antibody',
        vendor: 'Millipore',
        catalogNumber: 'MAB374',
        lotNumber: 'LOT-99',
        expiresOn: '2027-01-01',
        rrid: 'RRID:AB_2107445',
        stepNumbers: [1, 2],
      },
    ],
    photos: [
      {
        id: 'p1',
        at: Date.UTC(2026, 2, 12, 10),
        caption: 'Membrane after transfer',
        stepNumber: 1,
        mimeType: 'image/png',
        bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
        annotations: ['ladder'],
      },
    ],
    generatedAt: Date.UTC(2026, 2, 13),
    ...overrides,
  };
}

describe('zip writer', () => {
  it('round-trips names, sizes and contents, including UTF-8 names', () => {
    const bytes = buildZip(
      [
        { path: 'README.md', data: 'hello' },
        { path: 'photos/café.png', data: new Uint8Array([0, 255, 10]) },
        { path: 'empty.txt', data: '' },
      ],
      new Date(2026, 2, 13, 10, 30, 4),
    );
    const entries = readZip(bytes);
    expect([...entries.keys()]).toEqual(['README.md', 'photos/café.png', 'empty.txt']);
    expect(text(entries.get('README.md'))).toBe('hello');
    expect([...entries.get('photos/café.png')!]).toEqual([0, 255, 10]);
    expect(entries.get('empty.txt')!.length).toBe(0);
  });

  it('matches the standard CRC-32 check value and packs DOS dates', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const { date, time } = dosDateTime(new Date(2026, 2, 13, 10, 30, 4));
    expect(date).toBe(((2026 - 1980) << 9) | (3 << 5) | 13);
    expect(time).toBe((10 << 11) | (30 << 5) | 2);
  });
});

describe('research package contents', () => {
  it('contains every file the package promises', () => {
    const entries = readZip(buildZip(buildResearchPackage(input())));
    for (const name of [
      'README.md',
      'protocol.json',
      'protocol.md',
      'execution-log.json',
      'events.csv',
      'recorded-data.csv',
      'reagents.csv',
      'methods.txt',
      'metadata.json',
      '.zenodo.json',
      'photos/index.csv',
      'photos/photo-01.png',
    ]) {
      expect(entries.has(name), name).toBe(true);
    }
    expect([...entries.get('photos/photo-01.png')!]).toEqual([137, 80, 78, 71, 1, 2, 3]);
    expect(text(entries.get('methods.txt'))).toContain('5% milk');
  });

  it('writes reagents with lot, catalog number and RRID', () => {
    const files = buildResearchPackage(input());
    const reagents = files.find((f) => f.path === 'reagents.csv')!.data as string;
    expect(reagents).toContain('Name,Kind,Vendor,Catalog number,Lot number,Expires,RRID,Steps');
    expect(reagents).toContain('"Anti-GAPDH antibody, ""clone 6C5""",antibody,Millipore,MAB374,LOT-99,2027-01-01,RRID:AB_2107445,1 2');
  });

  it('writes DataCite-like metadata with creators, dates, license and related identifiers', () => {
    const files = buildResearchPackage(input());
    const metadata = JSON.parse(files.find((f) => f.path === 'metadata.json')!.data as string);
    expect(metadata.title).toBe('Blot 12 March');
    expect(metadata.creators).toEqual([{ name: 'Ana Lee', nameType: 'Personal' }]);
    expect(metadata.publicationYear).toBe(2026);
    expect(metadata.dates).toEqual([
      { date: '2026-03-11T00:00:00.000Z', dateType: 'Created' },
      { date: `${new Date(experiment.startedAt!).toISOString()}/${new Date(experiment.endedAt!).toISOString()}`, dateType: 'Collected' },
    ]);
    expect(metadata.rightsList[0]).toMatchObject({ rightsIdentifier: 'CC-BY-SA-4.0' });
    expect(metadata.keywords).toContain('Western Blot');
    expect(metadata.relatedIdentifiers).toEqual([
      { relatedIdentifier: '10.1234/abcd', relatedIdentifierType: 'DOI', relationType: 'IsDerivedFrom' },
      { relatedIdentifier: 'https://lab.example/shared#d=x', relatedIdentifierType: 'URL', relationType: 'IsDerivedFrom' },
    ]);
  });

  it('writes a Zenodo deposit file that matches the metadata', () => {
    const files = buildResearchPackage(input({ creators: ['Dr. Lab'] }));
    const zenodo = JSON.parse(files.find((f) => f.path === '.zenodo.json')!.data as string);
    expect(zenodo).toMatchObject({
      title: 'Blot 12 March',
      upload_type: 'dataset',
      creators: [{ name: 'Dr. Lab' }],
      license: 'cc-by-sa-4.0',
      access_right: 'open',
    });
    expect(zenodo.related_identifiers[0]).toEqual({ identifier: '10.1234/abcd', relation: 'isDerivedFrom', scheme: 'doi' });
  });

  it('closes access and omits the license when the protocol is all rights reserved', () => {
    const files = buildResearchPackage(input({ template: { ...template, license: 'All-rights-reserved' } }));
    const zenodo = JSON.parse(files.find((f) => f.path === '.zenodo.json')!.data as string);
    expect(zenodo.license).toBeUndefined();
    expect(zenodo.access_right).toBe('closed');
  });

  it('omits the photo index and photos when there are none', () => {
    const paths = buildResearchPackage(input({ photos: [] })).map((f) => f.path);
    expect(paths.some((p) => p.startsWith('photos/'))).toBe(false);
  });
});

describe('helpers', () => {
  it('finds an RRID in free text', () => {
    expect(findRrid('Goat anti-mouse (RRID:AB_2338840)')).toBe('RRID:AB_2338840');
    expect(findRrid(undefined, 'none here')).toBeUndefined();
  });

  it('renders the protocol as Markdown with numbered steps and timers', () => {
    const md = protocolToMarkdown('Western blot', undefined, template);
    expect(md.startsWith('# Western blot')).toBe(true);
    expect(md).toContain('1. **Block membrane**');
    expect(md).toContain('Timer: Block, 60 min');
    expect(md).toContain('Caution: Wear gloves');
  });
});

describe('research package additions', () => {
  it('writes comments and animals when there are some, and skips the files when there are not', () => {
    const withData = readZip(
      buildZip(
        buildResearchPackage(
          input({
            comments: [{ author: 'Ana Lee', text: 'Repeat the wash', createdAt: Date.UTC(2026, 2, 12, 11), resolved: false }],
            animals: [{ label: 'M-07', species: 'Mouse', strain: 'C57BL/6J', genotype: 'WT', sex: 'female', rrid: 'RRID:IMSR_JAX:000664' }],
          }),
        ),
      ),
    );
    expect(text(withData.get('comments.csv'))).toContain('Ana Lee,open,Repeat the wash');
    expect(text(withData.get('animals.csv'))).toContain('M-07,Mouse,C57BL/6J,WT,female,RRID:IMSR_JAX:000664');

    const without = readZip(buildZip(buildResearchPackage(input())));
    expect(without.has('comments.csv')).toBe(false);
    expect(without.has('animals.csv')).toBe(false);
  });

  it('puts the user name first among the creators and writes thumbnails beside the photos', () => {
    const base = input({ creators: [{ name: 'Ana Lee', orcid: '0000-0002-1825-0097' }, 'Ben Ko'] });
    const files = buildResearchPackage({
      ...base,
      photos: [{ ...base.photos[0], thumbnailBytes: new Uint8Array([1, 2]) }],
    });
    const metadata = JSON.parse(files.find((f) => f.path === 'metadata.json')!.data as string);
    expect(metadata.creators[0]).toMatchObject({ name: 'Ana Lee', nameIdentifiers: [{ nameIdentifier: '0000-0002-1825-0097' }] });
    expect(metadata.creators[1]).toEqual({ name: 'Ben Ko', nameType: 'Personal' });

    const entries = readZip(buildZip(files));
    expect([...entries.get('photos/thumbnails/photo-01.jpg')!]).toEqual([1, 2]);
    expect(text(entries.get('photos/index.csv'))).toContain('photos/thumbnails/photo-01.jpg');
  });
});
