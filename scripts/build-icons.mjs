// Generates the PWA raster icons and copies the brand SVG to public/.
// Source of truth: src/assets/brand/icon.svg. Run with: npm run icons
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brandPath = resolve(root, 'src/assets/brand/icon.svg');
const outDir = resolve(root, 'public/icons');
const green = '#006747';

const source = readFileSync(brandPath, 'utf8');

// The artwork without the outer <svg>, its <title>, or the rounded background rect.
// The rounded rect is re-drawn for each variant so maskable and apple icons can be full-bleed.
const artwork = source
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .replace('<rect width="120" height="120" rx="27" fill="#006747"></rect>', '');

if (artwork.length < 200 || !artwork.includes('mask')) {
  throw new Error('Unexpected icon.svg layout; update scripts/build-icons.mjs to match it.');
}

/** Rounded square, for "any" purpose icons. Corners stay transparent. */
const roundedSvg = source;

/** Full-bleed square with the mark inside the 80% safe zone, for maskable and apple-touch icons. */
const fullBleedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
  `<rect width="120" height="120" fill="${green}"/>` +
  `<g transform="translate(12 12) scale(0.8)">${artwork}</g></svg>`;

const outputs = [
  { file: 'icon-192.png', svg: roundedSvg, size: 192 },
  { file: 'icon-512.png', svg: roundedSvg, size: 512 },
  { file: 'icon-maskable-512.png', svg: fullBleedSvg, size: 512 },
  { file: 'apple-touch-icon.png', svg: fullBleedSvg, size: 180 },
];

mkdirSync(outDir, { recursive: true });
for (const { file, svg, size } of outputs) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(resolve(outDir, file), png);
  console.log(`wrote public/icons/${file} (${size}px)`);
}

copyFileSync(brandPath, resolve(root, 'public/icon.svg'));
console.log('copied brand icon to public/icon.svg');
