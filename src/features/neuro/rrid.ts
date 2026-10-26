/*
 * RRID (Research Resource Identifier) helpers. Pure: validation and search links. The identifier is stored in its own `rrid` field.
 */

export type RridKind = 'antibody' | 'mouse' | 'plasmid' | 'tool' | 'cell_line' | 'software' | 'drosophila' | 'zebrafish';

const PATTERNS: Array<{ kind: RridKind; re: RegExp; example: string }> = [
  { kind: 'antibody', re: /^RRID:AB_\d+$/, example: 'RRID:AB_2298772' },
  { kind: 'mouse', re: /^RRID:IMSR_[A-Z]+:\d+$/, example: 'RRID:IMSR_JAX:000664' },
  { kind: 'plasmid', re: /^RRID:Addgene_\d+$/, example: 'RRID:Addgene_50469' },
  { kind: 'tool', re: /^RRID:SCR_\d{6}$/, example: 'RRID:SCR_002285' },
  { kind: 'cell_line', re: /^RRID:CVCL_[A-Z0-9]{4}$/, example: 'RRID:CVCL_0033' },
  { kind: 'drosophila', re: /^RRID:BDSC_\d+$/, example: 'RRID:BDSC_9463' },
  { kind: 'zebrafish', re: /^RRID:ZFIN_ZDB-[A-Z]+-\d{6}-\d+$/, example: 'RRID:ZFIN_ZDB-GENO-990623-2' },
];

export const RRID_EXAMPLES = PATTERNS.map((p) => p.example);

export type RridCheck = { ok: true; value: string; kind: RridKind } | { ok: false; message: string };

/**
 * Checks an RRID. Accepts the "RRID:" prefix in any letter case, or a bare identifier such as
 * AB_2298772, and returns the normalised form. Returns a plain message when the format is wrong.
 */
export function validateRrid(input: string): RridCheck {
  const trimmed = input.trim().replace(/\s+/g, '');
  if (trimmed === '') return { ok: false, message: 'Paste an RRID, for example RRID:AB_2298772.' };
  const withPrefix = /^rrid:/i.test(trimmed) ? `RRID:${trimmed.slice(5)}` : /^(AB_|IMSR_|Addgene_|SCR_|CVCL_|BDSC_|ZFIN_)/.test(trimmed) ? `RRID:${trimmed}` : trimmed;
  const match = PATTERNS.find((p) => p.re.test(withPrefix));
  if (!match) {
    return { ok: false, message: `That does not look like an RRID. Examples: ${RRID_EXAMPLES.slice(0, 3).join(', ')}.` };
  }
  return { ok: true, value: withPrefix, kind: match.kind };
}

/** Search pages where the user can look up the RRID for a reagent, antibody or line. */
export function rridSearchLinks(name: string): Array<{ label: string; url: string }> {
  const q = encodeURIComponent(name.trim());
  if (!q) return [];
  return [
    { label: 'SciCrunch RRID portal', url: `https://scicrunch.org/resources/search?q=${q}` },
    { label: 'Antibody Registry', url: `https://www.antibodyregistry.org/search?q=${q}` },
  ];
}
