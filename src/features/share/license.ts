import { DEFAULT_LICENSE } from './benchflowFile';

export interface LicenseOption {
  id: string;
  label: string;
  /** Zenodo license identifier, or undefined when the work is not openly licensed. */
  zenodoId?: string;
  /** Short statement used in the research package. */
  statement: string;
}

export const LICENSE_OPTIONS: LicenseOption[] = [
  {
    id: 'CC-BY-4.0',
    label: 'CC BY 4.0 (attribution)',
    zenodoId: 'cc-by-4.0',
    statement: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  },
  { id: 'CC0-1.0', label: 'CC0 1.0 (public domain)', zenodoId: 'cc-zero', statement: 'Creative Commons CC0 1.0 Universal (public domain dedication)' },
  {
    id: 'CC-BY-SA-4.0',
    label: 'CC BY-SA 4.0 (attribution, share alike)',
    zenodoId: 'cc-by-sa-4.0',
    statement: 'Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
  },
  {
    id: 'All-rights-reserved',
    label: 'All rights reserved',
    statement: 'All rights reserved. No reuse without permission from the authors.',
  },
];

export function licenseOption(id: string | undefined): LicenseOption {
  return LICENSE_OPTIONS.find((l) => l.id === (id ?? DEFAULT_LICENSE)) ?? LICENSE_OPTIONS[0];
}
