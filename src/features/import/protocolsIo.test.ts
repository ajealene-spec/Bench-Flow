import { describe, expect, it } from 'vitest';
import { STARTER_TEMPLATES } from '../../content/protocols';
import {
  ProtocolsIoError,
  exportFileName,
  exportMarkdown,
  exportProtocolsIo,
  exportProtocolsIoJson,
  fetchProtocolsIoJson,
  importProtocolsIoJson,
  protocolsIoSlug,
  stripHtml,
} from './protocolsIo';

const source = STARTER_TEMPLATES.find((t) => t.title === 'Immunofluorescence on free-floating brain sections')!;

describe('protocols.io round trip', () => {
  it('imports our own export back to the same steps, phases, materials and hazards', () => {
    const json = exportProtocolsIoJson(source);
    const imported = importProtocolsIoJson(json, 1234);

    expect(imported.id).not.toBe(source.id);
    expect(imported.title).toBe(source.title);
    expect(imported.category).toBe(source.category);
    expect(imported.steps).toEqual(source.steps);
    expect(imported.phases).toEqual(source.phases);
    expect(imported.materials).toEqual(source.materials);
    expect(imported.hazards).toEqual(source.hazards);
    expect(imported.overview).toEqual(source.overview);
    expect(imported.license).toBe('CC BY 4.0');
    expect(imported.authors).toEqual(['Bench Flow starter']);
    expect(imported.createdAt).toBe(1234);
  });

  it('keeps forkedFrom with title, author, url and doi on import', () => {
    const fork = { title: 'Original protocol', author: 'A. Author', url: 'https://www.protocols.io/view/original-abc', doi: '10.17504/protocols.io.abc' };
    const json = exportProtocolsIoJson({ ...source, forkedFrom: fork });
    expect(importProtocolsIoJson(json).forkedFrom).toEqual(fork);
  });

  it('gives a source of the plain protocols.io shape a forkedFrom with its link and authors', () => {
    const plain = JSON.stringify({
      protocol: {
        title: 'Plain protocol',
        description: '<p>Test the thing.</p>',
        authors: [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }],
        doi: '10.17504/protocols.io.xyz',
        uri: 'plain-protocol-xyz',
        materials: [{ name: 'PBS', type: 'reagent' }, { name: 'Pipette', type: 'equipment' }],
        steps: [
          { title: 'Mix', description: '<p>Mix 2 mL of PBS.</p>', duration: 300 },
          { description: '<p>Incubate 1 h at 37 °C.</p>' },
        ],
      },
    });
    const template = importProtocolsIoJson(plain);
    expect(template.title).toBe('Plain protocol');
    expect(template.forkedFrom).toEqual({
      title: 'Plain protocol',
      author: 'Ada Lovelace, Grace Hopper',
      url: 'https://www.protocols.io/view/plain-protocol-xyz',
      doi: '10.17504/protocols.io.xyz',
    });
    expect(template.overview?.objective).toBe('Test the thing.');
    expect(template.steps[0]).toMatchObject({ title: 'Mix', instructions: 'Mix 2 mL of PBS.', durationSec: 300 });
    expect(template.steps[0].timers[0].durationSec).toBe(300);
    expect(template.steps[0].variables?.some((v) => v.token)).toBe(true);
    expect(template.steps[1].title).toBe('Incubate 1 h at 37 °C.');
    expect(template.materials?.map((m) => m.kind)).toEqual(['solution', 'equipment']);
  });

  it('round trips a template with the export document keeping the protocols.io shape', () => {
    const doc = exportProtocolsIo(source);
    expect(doc.format).toBe('protocols.io-compatible');
    expect(doc.protocol.steps).toHaveLength(source.steps.length);
    expect(doc.protocol.steps[0].description).toContain('<p>');
    expect(doc.protocol.steps.find((s) => s.duration)).toBeDefined();
  });
});

describe('protocols.io import errors', () => {
  it('rejects invalid JSON with a clear message', () => {
    expect(() => importProtocolsIoJson('{not json')).toThrow(ProtocolsIoError);
    expect(() => importProtocolsIoJson('{not json')).toThrow(/not valid JSON/);
  });

  it('rejects files with no steps', () => {
    expect(() => importProtocolsIoJson(JSON.stringify({ title: 'Empty' }))).toThrow(/No steps/);
    expect(() => importProtocolsIoJson(JSON.stringify({ title: 'Empty', steps: [] }))).toThrow(/No steps/);
  });

  it('rejects JSON that is not an object', () => {
    expect(() => importProtocolsIoJson('[1,2,3]')).toThrow(/does not look like/);
  });
});

describe('protocols.io links', () => {
  it('reads the slug from public view links', () => {
    expect(protocolsIoSlug('https://www.protocols.io/view/western-blot-abc123')).toBe('western-blot-abc123');
    expect(protocolsIoSlug('protocols.io/view/western-blot-abc123/')).toBe('western-blot-abc123');
    expect(protocolsIoSlug('https://example.com/view/x')).toBeNull();
    expect(protocolsIoSlug('not a link')).toBeNull();
  });

  it('fetches with only the slug, and turns failures into clear errors', async () => {
    const calls: string[] = [];
    const ok = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ payload: { title: 'T', steps: [{ title: 'S', description: '<p>x</p>' }] } }), { status: 200 });
    }) as unknown as typeof fetch;
    const text = await fetchProtocolsIoJson('https://www.protocols.io/view/t-abc', ok);
    expect(calls[0]).toBe('https://www.protocols.io/api/v3/protocols/t-abc');
    expect(importProtocolsIoJson(text).title).toBe('T');

    const notFound = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchProtocolsIoJson('https://www.protocols.io/view/t-abc', notFound)).rejects.toThrow(/could not find/);

    const priv = (async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    await expect(fetchProtocolsIoJson('https://www.protocols.io/view/t-abc', priv)).rejects.toThrow(/private/);

    const network = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(fetchProtocolsIoJson('https://www.protocols.io/view/t-abc', network)).rejects.toThrow(/Could not reach/);

    await expect(fetchProtocolsIoJson('https://example.com/nope', ok)).rejects.toThrow(/Paste a public/);
  });
});

describe('Markdown and file names', () => {
  it('writes the title, sections, steps and planned values', () => {
    const md = exportMarkdown(source);
    expect(md.startsWith(`# ${source.title}`)).toBe(true);
    expect(md).toContain('## Materials');
    expect(md).toContain('## Hazards');
    expect(md).toContain('### Day 1: block and primary antibody');
    expect(md).toContain('1. **Wash sections**');
    expect(md).toContain('Primary antibody volume: 4 µL (calculated)');
    expect(md).toContain('Caution:');
  });

  it('makes safe download names', () => {
    expect(exportFileName('Western blot: v2 / final!', 'json')).toBe('western-blot-v2-final.json');
    expect(exportFileName('   ', 'md')).toBe('protocol.md');
  });

  it('strips HTML to plain text', () => {
    expect(stripHtml('<p>Add 1&nbsp;mL &amp; mix.</p><p>Wait &lt;5 min&gt;</p>')).toBe('Add 1 mL & mix.\nWait <5 min>');
  });
});
