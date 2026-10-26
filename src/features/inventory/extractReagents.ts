import type { InventoryInput } from '../../db/inventory';
import type { InventoryKind, Reagent, Step } from '../../types';

/** One reagent, buffer, kit or antibody found in a protocol, ready to add to the inventory. */
export interface ExtractedReagent {
  name: string;
  kind: InventoryKind;
  vendor?: string;
  catalogNumber?: string;
  lotNumber?: string;
  concentration?: string;
  /** Working dilution written next to an antibody, e.g. "1:1000". Stored as the stock dilution. */
  stockDilution?: string;
  hostSpecies?: string;
  target?: string;
  conjugate?: string;
  isotype?: string;
  reactivity?: string[];
  /** Ids of the steps the item is mentioned in. */
  stepIds: string[];
}

export const SPECIES = [
  'rabbit',
  'mouse',
  'goat',
  'donkey',
  'rat',
  'chicken',
  'guinea pig',
  'human',
  'sheep',
  'hamster',
  'bovine',
  'horse',
] as const;

const SPECIES_ALT = SPECIES.map((s) => s.replace(' ', '\\s+')).join('|');
const CONJUGATE_ALT = String.raw`horseradish\s+peroxidase|HRP|alkaline\s+phosphatase|AP|FITC|biotin|Cy[357]|Alexa\s*Fluor\s*\d{3}|DyLight\s*\d{3}`;
const CONJUGATE_SUFFIX = new RegExp(`^(.+?)[\\s-]+(${CONJUGATE_ALT})$`, 'i');

/**
 * Antibody mentions. Branch 1: optional host species, optional clonality, "anti-<target>",
 * optional isotype and conjugate. Branch 2: "mouse monoclonal" / "polyclonal" with no target.
 */
const ANTIBODY_SOURCE =
  String.raw`\b(?:(?<host>${SPECIES_ALT})\s+)?(?:(?<clon>monoclonal|polyclonal)\s+)?anti(?:-|\s+)(?<target>[A-Za-z0-9][\w-]*)(?:\s+(?<isotype>IgG[12ab]?|IgM|IgA))?(?:[\s,;-]+(?<conj>${CONJUGATE_ALT}))?` +
  String.raw`|\b(?:(?<host2>${SPECIES_ALT})\s+)?(?<clon2>monoclonal|polyclonal)\b`;

/** Words that follow "anti-" but are not antibodies (e.g. anti-fade mounting medium). */
const NOT_ANTIBODY_TARGETS = new Set(['fade', 'fog', 'oxidant', 'microbial', 'body', 'bodies', 'freeze']);

const BUFFER_RE = /\b(PBS|PBST|TBS|TBST|saline|SSC|Tris|HEPES|buffer)\b/i;
const KIT_RE = /\bkit\b/i;
const CONCENTRATION_RE =
  /\d+(?:[.,]\d+)?\s*(?:mM|µM|μM|uM|nM|pM|M|mg\/m[lL]|µg\/m[lL]|μg\/m[lL]|ug\/m[lL]|ng\/m[lL]|%\s*(?:w\/v|v\/v|w\/w)?|[xX]\b|U\/m[lL]|units?\/m[lL])/;
const CONCENTRATION_UNIT_RE = /^(?:mM|µM|μM|uM|nM|pM|M|mg\/m[lL]|µg\/m[lL]|μg\/m[lL]|ug\/m[lL]|ng\/m[lL]|%(?:\s*(?:w\/v|v\/v|w\/w))?|[xX]|U\/m[lL]|units?\/m[lL])$/;
const LOT_RE = /\blot\s*(?:#|no\.?|number|:)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]*)/i;
const CATALOG_RE = /\b(?:cat(?:alog)?\.?|product|ordering)\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]*)/i;
const VENDOR_RE = /\b(?:vendor|supplier)\s*:\s*([^,;.()\n]{2,40})/i;
const PURCHASED_RE = /\bpurchased\s+from\s+([^,;.()\n]{2,40})/i;
const REACTIVITY_RE = /\breactiv(?:e|ity)\s*(?:with|to|:)?\s*:?\s*([^.;()\n]{2,80})/i;
const DILUTION_AFTER_RE = /^[\s,(]*(?:(?:at|diluted?|dilution|working|used)\s+)*(1\s*[:/]\s*\d[\d.]*)/i;

/** Full stops that do not end a sentence: decimals and common abbreviations such as "cat. no.". */
const ABBREVIATION_RE = /\b(no|cat|vol|approx|min|ca|nos)\./gi;
/** Segment separators: full stops that end a sentence, semicolons and line breaks. */
const SEGMENT_SPLIT_RE = /\.(?!\d)|(?<!\d)\.|;|\n/;

function splitSegments(text: string): string[] {
  return text.replace(ABBREVIATION_RE, '$1').split(SEGMENT_SPLIT_RE);
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function normalizeSpecies(value: string): string | undefined {
  const candidate = normalizeSpace(value.toLowerCase().replace(/-/g, ' '));
  return (SPECIES as readonly string[]).includes(candidate) ? candidate : undefined;
}

function normalizeIsotype(value: string): string {
  const match = value.match(/^ig([gma])(.*)$/i);
  return match ? `Ig${match[1].toUpperCase()}${match[2].toLowerCase()}` : value;
}

export function normalizeConjugate(raw: string): string {
  const value = normalizeSpace(raw);
  if (/alexa/i.test(value)) return `Alexa Fluor ${value.match(/\d{3}/)?.[0] ?? ''}`.trim();
  if (/dylight/i.test(value)) return `DyLight ${value.match(/\d{3}/)?.[0] ?? ''}`.trim();
  if (/horseradish|^HRP$/i.test(value)) return 'HRP';
  if (/alkaline|^AP$/i.test(value)) return 'AP';
  if (/^biotin$/i.test(value)) return 'Biotin';
  if (/^FITC$/i.test(value)) return 'FITC';
  if (/^cy([357])$/i.test(value)) return `Cy${value.slice(2)}`;
  return value;
}

/** A lot or catalog token must contain a digit, so "a lot of" is not read as a lot number. */
function tokenWithDigit(token: string | undefined): string | undefined {
  return token && /\d/.test(token) ? token : undefined;
}

interface SegmentFacts {
  lotNumber?: string;
  catalogNumber?: string;
  vendor?: string;
  reactivity?: string[];
}

function segmentFacts(segment: string): SegmentFacts {
  const facts: SegmentFacts = {};
  const lot = tokenWithDigit(segment.match(LOT_RE)?.[1]);
  if (lot) facts.lotNumber = lot;
  const catalog = tokenWithDigit(segment.match(CATALOG_RE)?.[1]);
  if (catalog) facts.catalogNumber = catalog;
  const vendor = (segment.match(VENDOR_RE) ?? segment.match(PURCHASED_RE))?.[1];
  if (vendor) facts.vendor = normalizeSpace(vendor);
  const reactivity = segment
    .match(REACTIVITY_RE)?.[1]
    ?.split(/,|\/|\band\b/i)
    .map((r) => normalizeSpace(r))
    .filter(Boolean);
  if (reactivity && reactivity.length > 0) facts.reactivity = reactivity.map((r) => r.toLowerCase());
  return facts;
}

interface FoundMention {
  item: ExtractedReagent;
  start: number;
  end: number;
}

/** Finds every antibody mention in a piece of text, with its position in that text. */
function findAntibodyMentions(text: string): FoundMention[] {
  const found: FoundMention[] = [];
  for (const match of text.matchAll(new RegExp(ANTIBODY_SOURCE, 'gi'))) {
    const g = match.groups ?? {};
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (g.target === undefined) {
      // "mouse monoclonal" or "polyclonal" with no target named.
      const host = g.host2 ? normalizeSpecies(g.host2) : undefined;
      const clon = g.clon2?.toLowerCase() ?? 'monoclonal';
      const base = `${host ? `${capitalize(host)} ` : ''}${clon} antibody`;
      found.push({ item: stripUndefined({ name: capitalize(base), kind: 'antibody' as const, hostSpecies: host, stepIds: [] }), start, end });
      continue;
    }

    let target = g.target;
    let conjugate = g.conj;
    const suffix = target.match(CONJUGATE_SUFFIX);
    if (suffix) {
      target = suffix[1];
      conjugate = conjugate ?? suffix[2];
    }
    if (NOT_ANTIBODY_TARGETS.has(target.toLowerCase())) continue;

    const host = g.host ? normalizeSpecies(g.host) : undefined;
    const targetSpecies = normalizeSpecies(target);
    const isotype = g.isotype ? normalizeIsotype(g.isotype) : undefined;
    const conj = conjugate ? normalizeConjugate(conjugate) : undefined;
    const hostPrefix = host ? `${capitalize(host)} ` : '';

    let baseName: string;
    let fields: Partial<ExtractedReagent>;
    if (targetSpecies) {
      // A secondary antibody: its target is a species ("anti-rabbit").
      baseName = `${host ? hostPrefix : 'Anti-'}${host ? 'anti-' : ''}${targetSpecies}${isotype ? ` ${isotype}` : ''}`;
      fields = { target: targetSpecies, hostSpecies: host, isotype, conjugate: conj };
    } else {
      const clonality = g.clon ? `${g.clon.toLowerCase()} ` : '';
      baseName = `${hostPrefix}${clonality}anti-${target}`;
      fields = { target, hostSpecies: host, isotype, conjugate: conj };
    }
    const name = conj ? `${baseName} (${conj})` : baseName;
    found.push({ item: stripUndefined({ name, kind: 'antibody' as const, stepIds: [], ...fields }), start, end });
  }
  return found;
}

/** Concentration written after an antibody mention, e.g. "anti-GFAP, 1 mg/mL". */
function concentrationAfter(text: string, end: number): string | undefined {
  const match = text.slice(end).match(CONCENTRATION_RE);
  return match ? normalizeSpace(match[0]) : undefined;
}

/** Working dilution written right after an antibody mention, normalized to "1:N". */
function dilutionAfter(text: string, end: number): string | undefined {
  const match = text.slice(end).match(DILUTION_AFTER_RE);
  return match ? match[1].replace(/\s+/g, '').replace('/', ':') : undefined;
}

function cleanReagentName(raw: string): string {
  return normalizeSpace(
    raw
      .replace(/\(.*?\)/g, ' ')
      .split(/,|\blot\b|\bcat(?:alog)?\b|\bvendor\b|\bsupplier\b/i)[0]
      .replace(/[:\-–]+$/, ''),
  );
}

function classify(name: string): InventoryKind {
  if (KIT_RE.test(name)) return 'kit';
  if (BUFFER_RE.test(name)) return 'buffer';
  return 'reagent';
}

/** Merges a mention into the running list. The same name (case-insensitive) is one item. */
function addItem(items: Map<string, ExtractedReagent>, item: ExtractedReagent, stepId: string): void {
  const key = `${item.kind}|${item.name.toLowerCase()}`;
  const existing = items.get(key);
  if (!existing) {
    items.set(key, { ...item, stepIds: [stepId] });
    return;
  }
  for (const field of ['vendor', 'catalogNumber', 'lotNumber', 'concentration', 'stockDilution', 'hostSpecies', 'target', 'conjugate', 'isotype'] as const) {
    if (existing[field] === undefined && item[field] !== undefined) existing[field] = item[field];
  }
  if (item.reactivity) existing.reactivity = [...new Set([...(existing.reactivity ?? []), ...item.reactivity])];
  if (!existing.stepIds.includes(stepId)) existing.stepIds.push(stepId);
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Pulls antibody mentions out of one text segment. Lot, catalog, vendor and reactivity are taken
 * from the segment only when it names exactly one antibody, so facts do not leak between antibodies.
 */
function extractFromSegment(segment: string, stepId: string, items: Map<string, ExtractedReagent>): void {
  const mentions = findAntibodyMentions(segment);
  const single = mentions.length === 1;
  const facts = single ? segmentFacts(segment) : {};
  for (const { item, end } of mentions) {
    addItem(
      items,
      stripUndefined({
        ...item,
        ...facts,
        stockDilution: dilutionAfter(segment, end),
        concentration: single ? concentrationAfter(segment, end) : undefined,
      }),
      stepId,
    );
  }
}

/** Handles a structured reagent entry from a step's reagent list. */
function extractFromReagent(reagent: Reagent, stepId: string, items: Map<string, ExtractedReagent>): void {
  const text = normalizeSpace(reagent.name);
  if (!text) return;
  const mentions = findAntibodyMentions(text);
  if (mentions.length > 0) {
    extractFromSegment(text, stepId, items);
    return;
  }

  const unit = reagent.unit?.trim();
  const amount = reagent.amount?.trim();
  const facts = segmentFacts(text);
  const name = cleanReagentName(text);
  if (!name) return;
  const concentration = amount && unit && CONCENTRATION_UNIT_RE.test(unit) ? `${amount} ${unit}` : undefined;
  addItem(
    items,
    stripUndefined({ name, kind: classify(name), ...facts, concentration, stepIds: [] }),
    stepId,
  );
}

/**
 * Finds reagents, buffers, kits and antibodies in a protocol's steps. Structured reagent entries
 * are read first, then the step instructions are scanned for antibody mentions. Items with the
 * same name are merged, and each lists the steps it appears in.
 */
export function extractReagents(steps: Array<Pick<Step, 'id' | 'instructions' | 'reagents'>>): ExtractedReagent[] {
  const items = new Map<string, ExtractedReagent>();
  for (const step of steps) {
    for (const reagent of step.reagents ?? []) extractFromReagent(reagent, step.id, items);
    for (const segment of splitSegments(step.instructions ?? '')) {
      if (segment.trim()) extractFromSegment(segment, step.id, items);
    }
  }
  return [...items.values()];
}

/** Converts an extracted item into the input the inventory expects. */
export function toInventoryInput(item: ExtractedReagent): InventoryInput {
  return {
    name: item.name,
    kind: item.kind,
    vendor: item.vendor,
    catalogNumber: item.catalogNumber,
    lotNumber: item.lotNumber,
    concentration: item.concentration,
    stockDilution: item.stockDilution,
    hostSpecies: item.hostSpecies,
    target: item.target,
    conjugate: item.conjugate,
    isotype: item.isotype,
    reactivity: item.reactivity,
  };
}
