import { describe, expect, it } from 'vitest';
import { THUMBNAIL_EDGE, thumbnailSize } from './thumbnail';

describe('thumbnailSize', () => {
  it('fits the longest side and keeps the aspect ratio', () => {
    expect(thumbnailSize(4032, 3024)).toEqual({ width: THUMBNAIL_EDGE, height: 360 });
    expect(thumbnailSize(3024, 4032)).toEqual({ width: 360, height: THUMBNAIL_EDGE });
  });

  it('never upscales a small image', () => {
    expect(thumbnailSize(200, 100)).toEqual({ width: 200, height: 100 });
  });

  it('returns zero for an empty image', () => {
    expect(thumbnailSize(0, 100)).toEqual({ width: 0, height: 0 });
  });
});
