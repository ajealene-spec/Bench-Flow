import { describe, expect, it } from 'vitest';
import type { PhotoAnnotation } from '../../../types';
import {
  addArrow,
  addLabel,
  annotationText,
  describeAnnotations,
  laneStrip,
  MAX_LABEL_LENGTH,
  parseAnnotations,
  removeAnnotation,
  serializeAnnotations,
} from './annotations';

const sample: PhotoAnnotation[] = [
  { id: 'a1', x: 0.25, y: 0.5, text: 'Actin' },
  { id: 'a2', x: 0.5, y: 0.75, text: 'Lane 2 faint' },
];

describe('annotation serialization', () => {
  it('round-trips the annotation array exactly', () => {
    expect(parseAnnotations(serializeAnnotations(sample))).toEqual(sample);
  });

  it('stores only id, position and text for labels', () => {
    const withExtra = { ...sample[0], extra: 1 };
    const json = serializeAnnotations([withExtra as unknown as PhotoAnnotation]);
    expect(JSON.parse(json)).toEqual([{ id: 'a1', x: 0.25, y: 0.5, text: 'Actin' }]);
  });

  it('round-trips arrows, with and without a caption', () => {
    const list: PhotoAnnotation[] = [
      { id: 'r1', type: 'arrow', x1: 0.1, y1: 0.1, x2: 0.6, y2: 0.4, text: 'Band' },
      { id: 'r2', type: 'arrow', x1: 0.9, y1: 0.9, x2: 0.5, y2: 0.5 },
    ];
    expect(parseAnnotations(serializeAnnotations(list))).toEqual(list);
  });

  it('drops arrows without four finite coordinates and clamps the rest', () => {
    const json = JSON.stringify([
      { id: 'bad', type: 'arrow', x1: 0.1, y1: 0.1, x2: 'x', y2: 0.2 },
      { id: 'ok', type: 'arrow', x1: -1, y1: 0.1, x2: 2, y2: 0.2 },
    ]);
    expect(parseAnnotations(json)).toEqual([{ id: 'ok', type: 'arrow', x1: 0, y1: 0.1, x2: 1, y2: 0.2 }]);
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
    const [parsed] = parseAnnotations(json) as Array<{ x: number; y: number; text: string }>;
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

describe('arrows', () => {
  it('adds an arrow with a trimmed caption and ignores a click that is too short', () => {
    const added = addArrow([], { x: 0.1, y: 0.2 }, { x: 0.5, y: 0.6 }, 'ar1', '  Band ');
    expect(added).toEqual([{ id: 'ar1', type: 'arrow', x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.6, text: 'Band' }]);
    expect(addArrow(added, { x: 0.3, y: 0.3 }, { x: 0.3, y: 0.31 }, 'ar2')).toBe(added);
  });

  it('gives arrows a text for captions and lists them in descriptions', () => {
    const list: PhotoAnnotation[] = [
      { id: 'a', x: 0.2, y: 0.2, text: 'Actin' },
      { id: 'b', type: 'arrow', x1: 0, y1: 0, x2: 1, y2: 1 },
      { id: 'c', type: 'arrow', x1: 0, y1: 0, x2: 1, y2: 1, text: 'Smear' },
    ];
    expect(list.map(annotationText)).toEqual(['Actin', '', 'Smear']);
    expect(describeAnnotations(list)).toEqual(['Actin', 'arrow', 'arrow: Smear']);
  });
});
