import { describe, expect, it } from 'vitest';
import type { PhotoAnnotation } from '../../../types';
import { addLabel, laneStrip, MAX_LABEL_LENGTH, parseAnnotations, removeAnnotation, serializeAnnotations } from './annotations';

const sample: PhotoAnnotation[] = [
  { id: 'a1', x: 0.25, y: 0.5, text: 'Actin' },
  { id: 'a2', x: 0.5, y: 0.75, text: 'Lane 2 faint' },
];

describe('annotation serialization', () => {
  it('round-trips the annotation array exactly', () => {
    expect(parseAnnotations(serializeAnnotations(sample))).toEqual(sample);
  });

  it('stores only id, position and text', () => {
    const json = serializeAnnotations([{ ...sample[0], extra: 1 } as PhotoAnnotation]);
    expect(JSON.parse(json)).toEqual([{ id: 'a1', x: 0.25, y: 0.5, text: 'Actin' }]);
  });

  it('returns an empty list for invalid JSON or a non-array', () => {
    expect(parseAnnotations('not json')).toEqual([]);
    expect(parseAnnotations('{"id":"x"}')).toEqual([]);
  });

  it('drops malformed entries and keeps the valid ones', () => {
    const json = JSON.stringify([
      null,
      { id: 1, x: 0.1, y: 0.1, text: 'bad id' },
      { id: 'b', x: 'left', y: 0.1, text: 'bad x' },
      { id: 'c', x: 0.1, y: 0.1, text: '   ' },
      { id: 'd', x: 0.1, y: 0.2, text: 'ok' },
    ]);
    expect(parseAnnotations(json)).toEqual([{ id: 'd', x: 0.1, y: 0.2, text: 'ok' }]);
  });

  it('clamps positions to the image and trims and caps the text', () => {
    const json = JSON.stringify([{ id: 'e', x: 1.5, y: -0.2, text: `  ${'x'.repeat(200)}  ` }]);
    const [parsed] = parseAnnotations(json);
    expect(parsed.x).toBe(1);
    expect(parsed.y).toBe(0);
    expect(parsed.text).toHaveLength(MAX_LABEL_LENGTH);
  });
});

describe('editing annotations', () => {
  it('adds a trimmed label and ignores blank text', () => {
    const added = addLabel([], 0.3, 0.4, '  Tubulin ', 'n1');
    expect(added).toEqual([{ id: 'n1', x: 0.3, y: 0.4, text: 'Tubulin' }]);
    expect(addLabel(added, 0.1, 0.1, '   ', 'n2')).toBe(added);
  });

  it('removes one annotation by id', () => {
    expect(removeAnnotation(sample, 'a1')).toEqual([sample[1]]);
  });
});

describe('laneStrip', () => {
  it('places numbered lanes evenly across the top', () => {
    const lanes = laneStrip(4, 'p');
    expect(lanes.map((l) => l.text)).toEqual(['1', '2', '3', '4']);
    expect(lanes.map((l) => l.x)).toEqual([0.125, 0.375, 0.625, 0.875]);
    expect(new Set(lanes.map((l) => l.y))).toEqual(new Set([0.04]));
  });

  it('keeps ids unique per prefix and limits the number of lanes', () => {
    const lanes = laneStrip(500, 'q');
    expect(lanes).toHaveLength(30);
    expect(new Set(lanes.map((l) => l.id)).size).toBe(30);
    expect(laneStrip(0, 'q')).toHaveLength(1);
  });
});
