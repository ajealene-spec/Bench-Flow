import { describe, expect, it } from 'vitest';
import { buildBenchflowPayload, parseBenchflowText, serializeBenchflow, SHARE_LINK_WARN_BYTES } from './benchflowFile';
import { buildShareLink, decodeSharePayload, encodeSharePayload, readShareHash } from './shareLink';
import type { ProtocolTemplate, Step } from '../../types';

function step(id: string, title: string, instructions = ''): Step {
  return { id, title, instructions, timers: [], reagents: [], dataFields: [], cautions: [] };
}

function template(steps: Step[]): ProtocolTemplate {
  return {
    id: 'tpl-1',
    title: 'Western blot',
    category: 'Western Blot',
    steps,
    hazards: [],
    authors: ['A. Author'],
    license: 'CC-BY-SA-4.0',
    createdAt: 1,
    updatedAt: 2,
  };
}

describe('share link round trip', () => {
  it('decodes exactly what was encoded', async () => {
    const payload = buildBenchflowPayload({
      template: template([step('s1', 'Lyse cells', 'Add 200 µL RIPA buffer.'), step('s2', 'Spin', 'Spin at 14,000 g.')]),
      version: 3,
      exportedAt: 1000,
    });
    const encoded = await encodeSharePayload(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodeSharePayload(encoded);
    expect(decoded).toEqual(parseBenchflowText(serializeBenchflow(payload)));
    expect(decoded.template.steps.map((s) => s.title)).toEqual(['Lyse cells', 'Spin']);
    expect(decoded.metadata).toMatchObject({ title: 'Western blot', authors: ['A. Author'], license: 'CC-BY-SA-4.0', version: 3 });
  });

  it('builds a /shared#d= link and reads the payload back from the hash', async () => {
    const payload = buildBenchflowPayload({ template: template([step('s1', 'One')]), version: 1, exportedAt: 1 });
    const link = await buildShareLink('https://lab.example/', payload);
    expect(link.url.startsWith('https://lab.example/shared#d=')).toBe(true);
    expect(link.tooLong).toBe(false);
    const hash = link.url.slice(link.url.indexOf('#'));
    const encoded = readShareHash(hash);
    expect(encoded).not.toBeNull();
    expect((await decodeSharePayload(encoded as string)).template.title).toBe('Western blot');
    expect(readShareHash('')).toBeNull();
  });

  it('flags links over the warning size', async () => {
    const big = 'x'.repeat(20000);
    // Random-looking text does not compress, so the link is large.
    const noisy = Array.from({ length: 400 }, (_, i) => Math.random().toString(36).repeat(3) + i + big.slice(0, 20));
    const payload = buildBenchflowPayload({
      template: template(noisy.map((text, i) => step(`s${i}`, `Step ${i}`, text))),
      version: 1,
      exportedAt: 1,
    });
    const link = await buildShareLink('https://lab.example', payload);
    expect(link.bytes).toBeGreaterThan(SHARE_LINK_WARN_BYTES);
    expect(link.tooLong).toBe(true);
  });

  it('rejects a damaged share payload with a readable message', async () => {
    await expect(decodeSharePayload('not-a-real-payload!!')).rejects.toThrow(/damaged or incomplete/);
  });
});
