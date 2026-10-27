/**
 * One place for the "sample data" wording and the demo detection. Pure: no database imports, so the
 * report, the package builder and the tour can all use it without pulling in Dexie.
 */

/** The notice shown on every screen, chart, table and export of the demo. Keep this text the same everywhere. */
export const SAMPLE_NOTICE =
  'Sample data — for demonstration only. These numbers are made up and are not real experimental results.';

/** Short form for places that need one line. */
export const SAMPLE_NOTICE_SHORT = 'Sample data, not real results.';

/** Prefix for the Methods paragraph of any sample run. */
export const SAMPLE_METHODS_PREFIX = '[SAMPLE DATA — NOT REAL RESULTS]';

/** The metadata.json "notes" value in a research package of the demo. */
export const SAMPLE_PACKAGE_NOTES = 'Sample data, not real results';

/**
 * Name of the seeded demo experiment. It is the marker for the demo: the seed writes this name and
 * `isDemoExperiment` checks it. Renaming the demo run in the app turns the sample markers off for it.
 * seed.ts re-exports this constant.
 */
export const DEMO_EXPERIMENT_NAME = 'Example: Fluo-4 calcium imaging in APOE3 vs APOE4 astrocytes';

/** True when the experiment is the seeded demo. Uses the stable seeded title, so no schema change is needed. */
export function isDemoExperiment(experiment: { name: string } | null | undefined): boolean {
  return experiment?.name === DEMO_EXPERIMENT_NAME;
}

/** Adds the Methods prefix once. Calling it again on prefixed text changes nothing. */
export function withSampleMethods(text: string): string {
  if (text.startsWith(SAMPLE_METHODS_PREFIX)) return text;
  return text ? `${SAMPLE_METHODS_PREFIX} ${text}` : SAMPLE_METHODS_PREFIX;
}

/** Puts the sample note on the first line of a CSV, keeping a leading byte-order mark (BOM) first. */
export function withSampleCsvNote(csv: string): string {
  const bom = csv.startsWith('﻿') ? '﻿' : '';
  const body = csv.slice(bom.length);
  return `${bom}# ${SAMPLE_NOTICE}\r\n${body}`;
}

/** Adds the sample note as the first field of a JSON object. The key is written first so it is seen first. */
export function withSampleJsonNote<T extends object>(value: T): { sampleDataNotice: string } & T {
  return { sampleDataNotice: SAMPLE_NOTICE, ...value };
}
