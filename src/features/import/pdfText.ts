import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** A positioned text run as pdf.js reports it. x/y are the run's origin in PDF points (y grows upward). */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageInput {
  width: number;
  items: PdfTextItem[];
}

/** Pages are separated by form feeds (the pdftotext convention). "[[page N]]" marker lines also work. */
const PAGE_SPLIT_RE = /\f|^\[\[page\s+\d+\]\]\s*$/m;
/** Items whose baselines differ by less than this share of their height are on the same line. */
const LINE_TOLERANCE = 0.5;
/** Two-column detection: a gap wider than this share of the page width, straddling the centre, is a gutter. */
const GUTTER_SHARE = 0.03;
/** Half-width of the band around the page centre that counts as the gutter. */
const CENTRE_BAND_SHARE = 0.02;

interface TextLine {
  y: number;
  items: PdfTextItem[];
}

function groupLines(items: PdfTextItem[]): TextLine[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextLine[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    const tolerance = Math.max(item.height || 10, 1) * LINE_TOLERANCE;
    if (last && Math.abs(last.y - item.y) <= tolerance) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  return lines;
}

/** Joins the runs of one line left to right, inserting a space where the gap between runs is visible. */
function joinRuns(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let text = '';
  let prevEnd: number | null = null;
  for (const item of sorted) {
    const height = item.height || 10;
    const gap = prevEnd === null ? 0 : item.x - prevEnd;
    if (text && gap > height * 0.15 && !/\s$/.test(text) && !/^\s/.test(item.str)) text += ' ';
    text += item.str;
    prevEnd = item.x + item.width;
  }
  return text.replace(/\s+/g, ' ').trim();
}

function isTwoColumn(items: PdfTextItem[], width: number): boolean {
  const mid = width / 2;
  const lines = groupLines(items);
  let straddling = 0;
  for (const line of lines) {
    const parts = [...line.items].sort((a, b) => a.x - b.x);
    for (let i = 1; i < parts.length; i++) {
      const prevEnd = parts[i - 1].x + parts[i - 1].width;
      const gap = parts[i].x - prevEnd;
      if (gap >= width * GUTTER_SHARE && prevEnd <= mid + width * CENTRE_BAND_SHARE && parts[i].x >= mid - width * CENTRE_BAND_SHARE) {
        straddling++;
        break;
      }
    }
  }
  return straddling >= 3 && straddling >= lines.length * 0.2;
}

/**
 * Rebuilds the reading-order lines of one page. Single-column pages are read top to bottom.
 * Two-column pages are read column by column (left, then right) between full-width lines.
 */
export function pageToLines(page: PdfPageInput): string[] {
  const items = page.items.filter((i) => i.str.trim());
  if (items.length === 0) return [];
  const width = page.width > 0 ? page.width : Math.max(...items.map((i) => i.x + i.width));

  if (!isTwoColumn(items, width)) {
    return groupLines(items)
      .map((line) => joinRuns(line.items))
      .filter(Boolean);
  }

  const mid = width / 2;
  const gutter = width * CENTRE_BAND_SHARE;
  const isFull = (i: PdfTextItem) => i.x < mid - gutter && i.x + i.width > mid + gutter;
  const fullItems = items.filter(isFull);
  const leftItems = items.filter((i) => !isFull(i) && i.x + i.width / 2 < mid);
  const rightItems = items.filter((i) => !isFull(i) && i.x + i.width / 2 >= mid);

  const toText = (lines: TextLine[]) =>
    lines.map((l) => ({ y: l.y, text: joinRuns(l.items) })).filter((l) => l.text);

  const fullLines = toText(groupLines(fullItems)).sort((a, b) => b.y - a.y);
  const bandOf = (y: number) => fullLines.filter((f) => f.y > y + 2).length;
  const leftLines = toText(groupLines(leftItems)).map((l) => ({ ...l, band: bandOf(l.y) }));
  const rightLines = toText(groupLines(rightItems)).map((l) => ({ ...l, band: bandOf(l.y) }));

  const out: string[] = [];
  for (let band = 0; band <= fullLines.length; band++) {
    for (const line of leftLines) if (line.band === band) out.push(line.text);
    for (const line of rightLines) if (line.band === band) out.push(line.text);
    if (band < fullLines.length) out.push(fullLines[band].text);
  }
  return out;
}

const URL_TEST_RE = /(?:https?:\/\/|www\.)\S+/i;
const URL_STRIP_RE = /(?:https?:\/\/|www\.)\S+/gi;
const PAGE_NUMBER_RE = /^(?:page\s+)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
const COPYRIGHT_RE = /©|\bcopyright\b|all rights reserved/i;
const FIGURE_CAPTION_RE = /^(?:figure|fig\.|table)\s+\d+[.:]?\s/i;

/** Removes URLs. A line that was mostly a URL (a few words left over) is dropped entirely. */
function normalizeLine(line: string): string {
  const cleaned = line.replace(URL_STRIP_RE, ' ').replace(/\s+/g, ' ').trim();
  if (URL_TEST_RE.test(line) && cleaned.split(' ').length < 6) return '';
  return cleaned;
}

/** Lines that repeat across pages are compared with digits masked, so "Page 2 of 9" matches "Page 3 of 9". */
function repeatKey(line: string): string {
  return line.toLowerCase().replace(/\d+/g, '#');
}

function isBoilerplate(line: string): boolean {
  return PAGE_NUMBER_RE.test(line) || COPYRIGHT_RE.test(line) || FIGURE_CAPTION_RE.test(line);
}

/**
 * Cleans raw page text: drops repeated headers and footers, page numbers, URLs, copyright
 * lines and figure captions, and joins words hyphenated across a line break.
 */
export function cleanExtractedText(raw: string): string {
  const pages = raw
    .replace(/\r\n?/g, '\n')
    .split(PAGE_SPLIT_RE)
    .map((page) => page.split('\n').map(normalizeLine).filter(Boolean))
    .filter((lines) => lines.length > 0);

  const pageCount = pages.length;
  const counts = new Map<string, number>();
  for (const lines of pages) {
    for (const key of new Set(lines.map(repeatKey))) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeatThreshold = pageCount >= 3 ? Math.max(2, Math.ceil(pageCount * 0.6)) : Infinity;

  const out: string[] = [];
  for (const lines of pages) {
    for (const line of lines) {
      if (!line || isBoilerplate(line)) continue;
      const key = repeatKey(line);
      if (key.length <= 120 && (counts.get(key) ?? 0) >= repeatThreshold) continue;

      const prev = out[out.length - 1];
      if (prev && /[a-z]-$/.test(prev) && /^[a-z]/.test(line)) {
        out[out.length - 1] = prev.slice(0, -1) + line;
      } else {
        out.push(line);
      }
    }
  }
  return out.join('\n');
}

/** Turns positioned page content into clean text: reading order, then header/footer cleanup. */
export function reconstructPages(pages: PdfPageInput[]): string {
  const text = pages.map((page) => pageToLines(page).join('\n')).join('\f');
  return cleanExtractedText(text);
}

/** Extracts clean, reading-ordered text from a PDF in the browser. Nothing is uploaded. */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfPageInput[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height });
      }
      pages.push({ width: viewport.width, items });
    }
  } finally {
    await doc.destroy();
  }
  return reconstructPages(pages);
}
