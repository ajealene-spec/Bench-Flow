// Generates the iOS app icon and launch splash in the Xcode asset catalogs.
// Source of truth: src/assets/brand/icon.svg. Run with: npm run ios:assets (after cap add ios / cap sync).
// The App Store icon must be 1024x1024 with no alpha channel, so the PNG is written as RGB.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const green = '#006747';
const source = readFileSync(resolve(root, 'src/assets/brand/icon.svg'), 'utf8');

// The artwork without the outer <svg>, title or rounded background (same extraction as scripts/build-icons.mjs).
const artwork = source
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .replace('<rect width="120" height="120" rx="27" fill="#006747"></rect>', '');
if (artwork.length < 200 || !artwork.includes('mask')) {
  throw new Error('Unexpected icon.svg layout; update scripts/build-ios-assets.mjs to match it.');
}

/** Full-bleed green square with the mark inside the 80% safe zone. Apple draws its own corner mask. */
function squareSvg(scale, offset) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
    `<rect width="120" height="120" fill="${green}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">${artwork}</g></svg>`;
}

// PNG encoder: RGB, 8-bit, no alpha channel.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function encodeRgbPng(width, height, rgba) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (width * 3 + 1) + 1 + x * 3;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB, no alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(svg, size) {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
  return encodeRgbPng(image.width, image.height, image.pixels);
}

const catalog = resolve(root, 'ios/App/App/Assets.xcassets');
if (!existsSync(catalog)) {
  throw new Error('ios/App/App/Assets.xcassets not found. Run cap sync ios first.');
}

// App icon: 1024x1024 opaque. The mark sits in the 80% safe zone.
const iconDir = resolve(catalog, 'AppIcon.appiconset');
mkdirSync(iconDir, { recursive: true });
writeFileSync(resolve(iconDir, 'AppIcon-512@2x.png'), render(squareSvg(0.8, 12), 1024));
console.log('wrote AppIcon-512@2x.png (1024px, RGB)');

// Splash: solid brand green with the mark at the centre. Same image for all three Xcode slots.
const splashSvg = squareSvg(0.35, 39);
const splashDir = resolve(catalog, 'Splash.imageset');
mkdirSync(splashDir, { recursive: true });
const splash = render(splashSvg, 2732);
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  writeFileSync(resolve(splashDir, name), splash);
}
console.log('wrote Splash.imageset (2732px, RGB)');
