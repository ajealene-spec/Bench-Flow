import type { MaterialKind, ProtocolPhase, Step, Timer } from '../../types';
import { detectDurations } from './localParse';
import { detectHazards, detectHazardsInText, splitSentences } from './hazards';
import { materialsFromSectionLines, materialsFromText, mergeMaterials, type MaterialCandidate } from './materials';
import { DEFAULT_TITLE, summarizeTotalTime, type ProtocolCategory, type ProtocolDraft } from './draft';

/**
 * Offline reader. Used when there is no AI key, or the device is offline. It builds the same
 * ProtocolDraft as the AI reader, from rules only:
 *
 * 1. strip PDF noise (page numbers, repeated headers and footers, URLs, RUO and copyright lines)
 * 2. find section headings (Materials, Reagents, Equipment, Procedure, Notes)
 * 3. split steps across list styles (1. 1) a. • - Step 1:) and paragraphs, merging wrapped lines
 * 4. find Day N and overnight phases, and sub-headings as stages
 * 5. take materials from the sections and from the steps
 * 6. flag hazards only on exact word matches, each with its evidence sentence
 * 7. score the category by keywords, and take the objective from an intro sentence
 */

const NOISE_LINE_RES: RegExp[] = [
  /^for research use only\b/i,
  /^not for (?:use in )?(?:diagnostic|therapeutic|clinical)\b/i,
  /^for in vitro (?:research|use)\b/i,
  /^(?:©|\(c\)|copyright\b)/i,
  /all rights reserved/i,
  /^(?:https?:\/\/|www\.)\S*$/i,
  /^(?:page\s+)?\d{1,3}\s*(?:of|\/)\s*\d{1,3}$/i,
  /^page\s+\d+/i,
  /^\d{1,3}$/,
  /^(?:rev(?:ision)?\.?|version|v)\s*\d[\w.]*$/i,
  /^(?:figure|fig\.)\s*\d+[.:]/i,
  /^(?:thermo fisher scientific|invitrogen|bio-?rad|sigma-aldrich|abcam|cell signaling technology)\b.{0,30}$/i,
];

const MATERIALS_HEAD_RE =
  /^(?:[A-Z]\.\s+|\d+\.\s+)?(?:required\s+|additional\s+)?(?:materials?(?:\s+(?:and|&)\s+(?:equipment|reagents|supplies))?|reagents?(?:\s+(?:and|&)\s+(?:equipment|materials|solutions?|buffers?))?|equipment(?:\s+(?:and|&)\s+(?:materials|supplies|reagents))?|solutions?|buffers?|recipes?|supplies|materials list|reagent table)\s*:?$/i;
const PROCEDURE_HEAD_RE =
  /^(?:[A-Z]\.\s+|\d+\.\s+)?(?:step-by-step\s+|detailed\s+|experimental\s+)?(?:procedure|protocol|method|methods|steps|instructions|workflow)\s*:?$/i;
const NOTES_HEAD_RE =
  /^(?:[A-Z]\.\s+|\d+\.\s+)?(?:notes?|introduction|background|overview|purpose|objective|troubleshooting|references?|tips|timing|expected results?|expected outcomes?|results|safety|ordering information|about this (?:guide|protocol))\s*:?$/i;
const INLINE_MATERIALS_RE = /^(materials?|reagents?|equipment|supplies)\s*:\s*(.+)$/i;
const INLINE_EXPECTED_RE = /^expected (?:results?|outcomes?|output)\s*:\s*(.+)$/i;
const PHASE_HEAD_RE = /^(?:day|phase)\s+\d+\b.*$/i;
const ITEM_RE =
  /^\s*(?:step\s+\d{1,3}\s*[:.)-]\s*|step\s+\d{1,3}\s+|\d{1,3}\s*[.)]\s+|\(\d{1,3}\)\s+|[a-z][.)]\s+|[-*•·–]\s+)(.+?)\s*$/i;
const CAUTION_LINE_RE = /^(?:caution|warning|danger|note|important|critical|attention|safety|hazard)\b\s*[:!-]?\s*/i;
const DAY_CUE_RE = /^(?:on\s+)?(?:day\s+(\d+)|the next day|next day|the following day|tomorrow)\b/i;
const OVERNIGHT_RE = /\b(?:overnight|o\/n)\b/i;
/** "3 x 5 min" or "3 times for 5 min" written as a count and a duration, so the total counts all repeats. */
const REPEAT_RE = /\b(\d{1,2})\s*(?:x|×|times)\s*(?:for\s+)?(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)\b/gi;

/** Durations in a step, counting repeats ("3 x 5 min" is 15 min). */
function stepDurations(text: string): ReturnType<typeof detectDurations> {
  return detectDurations(text.replace(REPEAT_RE, (_m, n: string, v: string, u: string) => `${Number(n) * parseFloat(v.replace(',', '.'))} ${u}`));
}

/** Action words that make a sentence a step in paragraph or notes text. */
const ACTION_RE =
  /\b(?:add|aliquot|apply|aspirate|block|boil|centrifug\w*|change|chill|coat|collect|combine|culture|cut|dilut\w*|dispense|dissect\w*|dry|embed|equilibrat\w*|expose|fill|filter|fix\w*|harvest\w*|heat|image|imaging|incubat\w*|inject\w*|label\w*|let|load\w*|lyse|measure|mix\w*|mount\w*|perfus\w*|pipett\w*|place|plate|pour|prepare|quantif\w*|record\w*|remove|resuspend|rinse|run|seed\w*|section\w*|set|shake|spin|split|stain\w*|store|thaw\w*|transfer\w*|treat\w*|vortex|wait|wash\w*|weigh|wipe|analy[sz]\w*|anesthe\w*|sacrifice|dissolve|make|keep|allow|discard|cover|open|close|cool|warm|reconstitute|detect\w*|capture|acquire|scan|extract\w*|precipitate|elute|digest|ligate|transform\w*|amplify|denature|anneal|sterili[sz]\w*|autoclave|sonicate|homogeni[sz]\w*|permeabili[sz]\w*|image|plate|suspend|count|pass|feed|trypsini[sz]\w*|split|image|fix)\b/i;

const OBJECTIVE_RE =
  /\b(?:purpose|aim|objective|goal|this (?:protocol|procedure|method|guide|assay|experiment)|we (?:describe|present|developed|use)|describes?|is used to|are used to|used to|allows?|enables?|to (?:measure|quantify|detect|assess|investigate|study|determine|evaluate|analy[sz]e|visuali[sz]e|identify|examine))\b/i;
const EXPECTED_RE =
  /\b(?:expected (?:results?|outcomes?|output|yields?|values?)|you should (?:obtain|see|get)|yields?|will (?:produce|yield|give)|produces?)\b/i;

const CATEGORY_KEYWORDS: Array<[ProtocolCategory, RegExp[]]> = [
  ['Western Blot', [/western blot/gi, /immunoblot/gi, /\bsds[- ]?page\b/gi, /\bwet transfer\b|\bsemi-dry\b|transfer buffer|nitrocellulose|\bpvdf\b/gi, /\bECL\b/g, /\bblot(?:s|ting|ted)?\b/gi]],
  ['PCR/qPCR', [/\bpcr\b/gi, /\bqpcr\b|\bqrt-pcr\b/gi, /\bprimers?\b/gi, /\bcdna\b/gi, /\bthermocycler\b/gi, /\bct values?\b/gi, /reverse transcription/gi, /\bannealing\b/gi]],
  ['Cell Culture', [/cell culture/gi, /\bpassag\w*/gi, /\bconfluen\w*/gi, /\btrypsin\w*/gi, /\bflasks?\b/gi, /\bmedium\b|\bmedia\b/gi, /\bseeding\b|\bseeded\b/gi, /\bsubculture\b/gi, /\bdissociat\w*/gi]],
  ['Imaging', [/\bimag(?:e|es|ing|ed)\b/gi, /\bfps\b/gi, /\bmicroscop\w*/gi, /\bfiji\b|imagej/gi, /\bROIs?\b/gi, /\bfluorescen\w*/gi, /\bcalcium\b/gi, /\bconfocal\b/gi, /ΔF\/F0?/g, /\bAUC\b/g]],
  ['Immunostaining', [/immunostain\w*/gi, /immunofluoresc\w*/gi, /\bprimary antibod\w*/gi, /\bsecondary antibod\w*/gi, /\bpermeabili[sz]\w*/gi, /\bDAPI\b/g, /\bcoverslips?\b/gi, /normal (?:goat|donkey) serum/gi]],
  ['Histology', [/\bhistolog\w*/gi, /\bmicrotome\b/gi, /\bparaffin\b/gi, /\bcryosection\w*/gi, /\bsections?\b/gi, /\bh&e\b|hematoxylin|\beosin\b/gi, /\bembed\w*/gi, /\bfixed tissue\b/gi]],
  ['Electrophysiology', [/electrophysiolog\w*/gi, /patch[- ]clamp/gi, /whole[- ]cell/gi, /\bamplifier\b/gi, /\bslices?\b/gi, /\bEPSCs?\b|\bIPSCs?\b|\bEPSPs?\b/g, /\bpipettes?\b/gi]],
  ['Animal Procedures', [/\b(?:mice|mouse|rats?|animals?|murine)\b/gi, /\bperfusion\b|\bperfuse\w*/gi, /\bisoflurane\b|\bketamine\b|anesthe\w*/gi, /\bsurg\w*/gi, /\binject\w*/gi, /\bIACUC\b/g, /\beuthan\w*/gi]],
  ['Molecular Cloning', [/\bcloning\b/gi, /\bligat\w*/gi, /\bplasmids?\b/gi, /restriction (?:enzyme|digest)/gi, /\btransformation\b|\btransform(?:ed)?\b/gi, /competent cells?/gi, /\bcolon(?:y|ies)\b/gi, /\bminiprep\b/gi, /gel extraction/gi]],
  ['Protein Assay', [/\bBCA\b|\bBradford\b/g, /protein (?:assay|concentration|quantification|determination)/gi, /standard curve/gi, /\babsorbance\b/gi, /\bBSA standard/gi, /\bquantif\w*/gi]],
];

interface Line {
  text: string;
  /** Which section the line sits in. */
  section: 'intro' | 'materials' | 'procedure' | 'notes';
  /** For materials lines: the kind the heading implies. */
  materialKind?: MaterialKind;
}

type Item =
  | { kind: 'step'; text: string }
  | { kind: 'caution'; text: string }
  | { kind: 'phase'; name: string }
  | { kind: 'stage'; name: string };

/** Drops page noise and repeated header/footer lines, and joins words hyphenated across a line break. */
export function stripNoise(text: string): string[] {
  const raw = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const counts = new Map<string, number>();
  for (const line of raw) if (line.length > 0 && line.length <= 80) counts.set(line, (counts.get(line) ?? 0) + 1);
  const repeatedThreshold = Math.max(3, Math.ceil(raw.length / 40));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of raw) {
    if (!line) {
      out.push('');
      continue;
    }
    if (NOISE_LINE_RES.some((re) => re.test(line))) continue;
    // A running header repeats on every page. Keep its first occurrence (often the title) and drop the rest.
    const repeated = line.length <= 80 && (counts.get(line) ?? 0) >= repeatedThreshold && !ITEM_RE.test(line);
    if (repeated && seen.has(line)) continue;
    seen.add(line);
    const prev = out[out.length - 1];
    if (prev && /[a-z]-$/.test(prev) && /^[a-z]/.test(line)) {
      out[out.length - 1] = prev.slice(0, -1) + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const TITLE_STOP_TAIL = /^(?:the|a|an|of|to|with|in|on|for|and|at|by|from|into|per|using|until|over|then)$/i;
/** Numbers, units and small words that should not end a title ("Wash three times for 5 min" -> "Wash three times"). */
const TITLE_JUNK_TAIL = /^(?:\d[\d.,:x×^-]*%?|°?[CF]|%|µ?[LlMm]|min|h|s|rpm|g|x|sec|hours?|minutes?)$/i;
const LEAD_FILLER_RE =
  /^(?:on day \d+,?\s*|day \d+[:,]?\s*|the next day,?\s*|then,?\s+|next,?\s+|finally,?\s+|now,?\s+|also,?\s+|after that,?\s+|once (?:this is )?done,?\s+|(?:so|ok|okay|like|basically)[,]?\s+|(?:first|first,)\s+(?:we\s+|you\s+)?|(?:we|you)\s+(?:then\s+)?)/i;

/** A 3 to 5 word imperative title from the first clause of a step. */
export function shortTitle(text: string): string {
  const s = text.replace(LEAD_FILLER_RE, '').trim();
  const first = (s.split(/(?<=[.!?])\s+/)[0] ?? s).replace(/[.!?]+$/, '').replace(/\([^)]*\)/g, '');
  let words = (first.split(/\s*[:;]\s*|,\s+|\s[–—-]\s/)[0] ?? first).split(/\s+/).filter(Boolean);
  if (words.length < 3) words = first.replace(/[:;,]/g, ' ').split(/\s+/).filter(Boolean);
  words = words.slice(0, 5);
  while (words.length > 3 && (TITLE_STOP_TAIL.test(words[words.length - 1]) || TITLE_JUNK_TAIL.test(words[words.length - 1]))) {
    words.pop();
  }
  const title = words.join(' ').replace(/[,;:]+$/, '');
  return capitalize(title || text.trim().slice(0, 40));
}

function isHeadingLine(line: string): boolean {
  return MATERIALS_HEAD_RE.test(line) || PROCEDURE_HEAD_RE.test(line) || NOTES_HEAD_RE.test(line);
}

/** A short line with no sentence punctuation, such as "Sample preparation" or "Imaging". */
function isStageHeading(line: string): boolean {
  if (line.length > 50 || /[.!?;,]$/.test(line) || ITEM_RE.test(line)) return false;
  return line.replace(/:$/, '').split(/\s+/).length <= 5;
}

function sectionKindFor(heading: string): MaterialKind | undefined {
  // "Materials and equipment" is mixed, so it gives no kind; only a heading that names one kind does.
  if (/materials|reagents|supplies/i.test(heading)) return undefined;
  if (/equipment|instrument/i.test(heading)) return 'equipment';
  if (/solution|buffer|recipe/i.test(heading)) return 'solution';
  return undefined;
}

/** Assigns each line to a section. */
function sectionLines(lines: string[]): { lines: Line[]; hasProcedureHeading: boolean } {
  const out: Line[] = [];
  let section: Line['section'] = 'intro';
  let materialKind: MaterialKind | undefined;
  let hasProcedureHeading = false;

  for (const line of lines) {
    if (!line) continue;
    if (PROCEDURE_HEAD_RE.test(line)) {
      section = 'procedure';
      hasProcedureHeading = true;
      continue;
    }
    if (MATERIALS_HEAD_RE.test(line)) {
      section = 'materials';
      materialKind = sectionKindFor(line);
      continue;
    }
    if (NOTES_HEAD_RE.test(line)) {
      section = 'notes';
      continue;
    }
    const inline = INLINE_MATERIALS_RE.exec(line);
    if (inline) {
      out.push({ text: inline[2], section: 'materials', materialKind: sectionKindFor(inline[1]) });
      continue;
    }
    if (PHASE_HEAD_RE.test(line) && line.length <= 80 && !/[.!?]$/.test(line)) {
      // A Day or Phase heading starts the procedure even when the text has no Procedure heading.
      section = section === 'materials' ? 'procedure' : section;
      out.push({ text: line, section: 'procedure' });
      continue;
    }
    out.push({ text: line, section, materialKind: section === 'materials' ? materialKind : undefined });
  }
  return { lines: out, hasProcedureHeading };
}

/** Builds the list of steps, cautions, phase headings and stage headings from the procedure lines. */
function procedureItems(procLines: string[]): Item[] {
  const listMode = procLines.some((l) => ITEM_RE.test(l));
  const items: Item[] = [];

  if (listMode) {
    let open: Item | undefined;
    let seenItem = false;
    for (let i = 0; i < procLines.length; i++) {
      const line = procLines[i];
      if (!line) {
        open = undefined;
        continue;
      }
      if (PHASE_HEAD_RE.test(line) && line.length <= 80 && !/[.!?]$/.test(line)) {
        items.push({ kind: 'phase', name: capitalize(line.replace(/[:\s]+$/, '')).slice(0, 60) });
        open = undefined;
        continue;
      }
      const match = ITEM_RE.exec(line);
      if (!match && CAUTION_LINE_RE.test(line)) {
        items.push({ kind: 'caution', text: line.replace(CAUTION_LINE_RE, '').trim() || line });
        open = undefined;
        continue;
      }
      if (match) {
        seenItem = true;
        const text = match[1];
        open = CAUTION_LINE_RE.test(text)
          ? { kind: 'caution', text: text.replace(CAUTION_LINE_RE, '').trim() || text }
          : { kind: 'step', text };
        items.push(open);
        continue;
      }
      const nextIsItem = ITEM_RE.test(procLines.slice(i + 1).find((l) => l) ?? '');
      if (isStageHeading(line) && nextIsItem) {
        items.push({ kind: 'stage', name: capitalize(line.replace(/:$/, '')) });
        open = undefined;
        continue;
      }
      const continues = open && open.kind !== 'phase' && open.kind !== 'stage' && (/^[a-z(]/.test(line) || (open.text.length >= 55 && !/[.!?:]$/.test(open.text)));
      if (continues && open && 'text' in open) {
        open.text = `${open.text} ${line}`;
      } else if (seenItem && ACTION_RE.test(line) && !isHeadingLine(line)) {
        // A plain line after the list has started is a step. Lines before the first item are the title or intro.
        open = { kind: 'step', text: line };
        items.push(open);
      }
    }
    return items;
  }

  // Paragraph or notes text: join wrapped lines, then split into sentences and keep the action ones.
  const buffers: string[] = [];
  for (const line of procLines) {
    if (!line) {
      buffers.push('');
      continue;
    }
    if (PHASE_HEAD_RE.test(line) && line.length <= 80 && !/[.!?]$/.test(line)) {
      items.push({ kind: 'phase', name: capitalize(line.replace(/[:\s]+$/, '')).slice(0, 60) });
      buffers.push('');
      continue;
    }
    const prev = buffers[buffers.length - 1];
    if (prev && prev.length >= 55 && !/[.!?:]$/.test(prev) && /^[a-z(]/.test(line)) {
      buffers[buffers.length - 1] = `${prev} ${line}`;
    } else {
      buffers.push(line);
    }
  }
  let first = true;
  for (const buffer of buffers) {
    if (!buffer) continue;
    for (const sentence of splitSentences(buffer)) {
      // The first sentence of a paragraph is often the purpose ("qPCR to quantify ..."), not a step.
      const isPurpose = first && OBJECTIVE_RE.test(sentence) && !CAUTION_LINE_RE.test(sentence);
      first = false;
      if (isPurpose) continue;
      if (CAUTION_LINE_RE.test(sentence)) {
        items.push({ kind: 'caution', text: sentence.replace(CAUTION_LINE_RE, '').trim() || sentence });
      } else if (ACTION_RE.test(sentence) || stepDurations(sentence).length > 0) {
        items.push({ kind: 'step', text: sentence });
      }
    }
  }
  return items;
}

interface Built {
  step: Step;
  phaseIndex: number | null;
}

/** Title of the protocol: the first short line before any section heading, else a category name. */
function findTitle(lines: string[], category: ProtocolCategory): string {
  for (const line of lines) {
    if (!line) continue;
    if (isHeadingLine(line) || PHASE_HEAD_RE.test(line) || ITEM_RE.test(line) || INLINE_MATERIALS_RE.test(line)) break;
    const words = line.split(/\s+/).length;
    if (words <= 12 && !/[:;]$/.test(line)) return line.replace(/[.!?]+$/, '').slice(0, 120);
    break;
  }
  return category === 'Other' ? DEFAULT_TITLE : `${category} protocol`;
}

export function scoreCategory(text: string): ProtocolCategory {
  let best: ProtocolCategory = 'Other';
  let bestScore = 0;
  for (const [category, patterns] of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const re of patterns) score += (text.match(re) ?? []).length;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

/** The sentence that states the purpose, rewritten as "To ..." when it says "This protocol describes how to ...". */
function findObjective(sentences: string[]): string | undefined {
  for (const raw of sentences) {
    const s = capitalize(raw.replace(/^(?:purpose|aim|objective|goal)\s*:\s*/i, ''));
    if (s.length < 20 || s.length > 240 || ITEM_RE.test(s)) continue;
    if (ACTION_RE.test(s) && !OBJECTIVE_RE.test(s)) continue;
    if (!OBJECTIVE_RE.test(s)) continue;
    const rewritten = /^this (?:protocol|procedure|method|guide|assay)\s+(?:describes|outlines|explains|presents|details)\s+(?:how\s+)?to\s+(.+)$/i.exec(s);
    if (rewritten) return `${capitalize(`to ${rewritten[1]}`).replace(/\.$/, '')}.`;
    return s;
  }
  return undefined;
}

export function parseOffline(input: string): ProtocolDraft {
  const lines = stripNoise(input);
  const sections = sectionLines(lines);
  const { lines: tagged, hasProcedureHeading } = sections;

  const materialLines = tagged.filter((l) => l.section === 'materials');
  const notesLines = tagged.filter((l) => l.section === 'notes');
  const introLines = tagged.filter((l) => l.section === 'intro').map((l) => l.text);
  const procLines = hasProcedureHeading
    ? tagged.filter((l) => l.section === 'procedure').map((l) => l.text)
    : tagged.filter((l) => l.section !== 'materials' && l.section !== 'notes').map((l) => l.text);

  const items = procedureItems(procLines.length > 0 ? procLines : tagged.map((l) => l.text));
  const procText = items.map((i) => (i.kind === 'step' ? i.text : '')).join('\n');
  const fullText = lines.filter(Boolean).join('\n');

  const category = scoreCategory(fullText);
  const title = findTitle(lines.filter(Boolean), category);

  // Phases: explicit Day N and overnight cues win. Otherwise sub-headings become stages.
  const dayMode =
    items.some((i) => i.kind === 'phase') ||
    items.some((i) => i.kind === 'step' && (DAY_CUE_RE.test(i.text) || OVERNIGHT_RE.test(i.text)));
  const stageCount = items.filter((i) => i.kind === 'stage').length;

  const phases: ProtocolPhase[] = [];
  const phaseAuto: boolean[] = [];
  let currentPhase = -1;
  let pendingNewDay = false;
  let stageName: string | undefined;
  const built: Built[] = [];
  let pendingCautions: string[] = [];
  let lastStep: Built | undefined;

  const newPhase = (name: string, auto: boolean) => {
    phases.push({ id: crypto.randomUUID(), name });
    phaseAuto.push(auto);
    currentPhase = phases.length - 1;
  };

  for (const item of items) {
    if (item.kind === 'stage') {
      stageName = item.name;
      continue;
    }
    if (item.kind === 'phase') {
      newPhase(item.name, false);
      pendingNewDay = false;
      continue;
    }
    if (item.kind === 'caution') {
      if (lastStep) lastStep.step.cautions.push(item.text);
      else pendingCautions.push(item.text);
      continue;
    }

    const text = item.text;
    if (dayMode) {
      const cueDay = DAY_CUE_RE.exec(text)?.[1];
      const needsNew =
        currentPhase === -1 ||
        pendingNewDay ||
        (cueDay !== undefined && !phases[currentPhase].name.startsWith(`Day ${cueDay}`));
      if (needsNew) newPhase(`Day ${cueDay ?? phases.length + 1}`, true);
      pendingNewDay = false;
    } else if (stageCount >= 2 && stageName !== undefined) {
      if (phases[currentPhase]?.name !== stageName) newPhase(stageName, false);
    }

    const durations = stepDurations(text);
    const id = crypto.randomUUID();
    const timers: Timer[] = durations.map((d) => ({
      id: crypto.randomUUID(),
      stepId: id,
      label: d.label,
      durationSec: d.seconds,
      status: 'idle',
    }));
    const sum = durations.reduce((acc, d) => acc + d.seconds, 0);
    const step: Step = {
      id,
      title: shortTitle(text),
      instructions: text,
      durationSec: sum > 0 ? sum : undefined,
      timers,
      reagents: [],
      dataFields: [],
      cautions: [...pendingCautions],
    };
    pendingCautions = [];
    const entry: Built = { step, phaseIndex: dayMode || (stageCount >= 2 && stageName) ? currentPhase : null };
    built.push(entry);
    lastStep = entry;

    if (dayMode && OVERNIGHT_RE.test(text)) pendingNewDay = true;
  }

  // Name auto phases after their first step, and drop phases that ended up empty.
  const stepsByPhase = new Map<number, Built[]>();
  for (const b of built) {
    if (b.phaseIndex === null) continue;
    stepsByPhase.set(b.phaseIndex, [...(stepsByPhase.get(b.phaseIndex) ?? []), b]);
  }
  const keep: number[] = [];
  phases.forEach((p, idx) => {
    const members = stepsByPhase.get(idx) ?? [];
    if (members.length === 0) return;
    keep.push(idx);
    if (phaseAuto[idx] && members[0]) p.name = `${p.name}: ${members[0].step.title}`.slice(0, 60);
  });
  const remap = new Map(keep.map((oldIdx, newIdx) => [oldIdx, newIdx]));
  const finalPhases = keep.map((i) => phases[i]);
  const finalSteps: Step[] = built.map((b) => {
    const phaseId = b.phaseIndex !== null && remap.has(b.phaseIndex) ? phases[b.phaseIndex].id : undefined;
    return phaseId ? { ...b.step, phaseId } : b.step;
  });

  const materialCandidates: MaterialCandidate[] = materialLines.flatMap((line) =>
    materialsFromSectionLines([line.text], line.materialKind),
  );
  const materials = mergeMaterials(materialCandidates, materialsFromText(procText || fullText));

  const hazardHits = detectHazardsInText(fullText);
  const stepHazards = detectHazards(finalSteps);
  const hazards = hazardHits.map((h) => ({
    ...h,
    stepIds: stepHazards.find((s) => s.id === h.id)?.stepIds ?? [],
  }));

  const objective = findObjective(splitSentences([...introLines, ...notesLines.map((l) => l.text)].join('\n')));
  const expected = [...notesLines.map((l) => l.text), ...lines]
    .map((l) => INLINE_EXPECTED_RE.exec(l)?.[1] ?? l)
    .flatMap((l) => splitSentences(l))
    .find((s) => EXPECTED_RE.test(s) && !ITEM_RE.test(s) && s.length <= 240);

  const totals = summarizeTotalTime(finalSteps, finalPhases.filter((p) => /^day\s+\d/i.test(p.name)).length);
  return {
    title,
    category,
    overview: {
      objective: objective ?? `To perform ${category === 'Other' ? title : category}.`,
      outputs: expected ?? 'Not stated in the text',
      totalTime: totals.display ?? 'Not stated',
    },
    phases: finalPhases,
    materials,
    hazards,
    steps: finalSteps,
    parser: 'local',
    note: '',
  };
}

