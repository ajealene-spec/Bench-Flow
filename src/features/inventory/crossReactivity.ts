import type { InventoryItem } from '../../types';
import { SPECIES } from './extractReagents';

export type CrossReactivityItem = Pick<InventoryItem, 'name' | 'kind' | 'hostSpecies' | 'target' | 'conjugate' | 'isotype'>;

export interface CrossReactivityOptions {
  /** True when two or more targets are detected in the same sample at once. */
  multiplex?: boolean;
  /** Species of the tissue or cells being stained, e.g. "mouse". */
  tissueSpecies?: string;
  /** Species of the serum used as a blocking agent, e.g. "goat". */
  blockingSerum?: string;
}

export interface CrossReactivityWarning {
  code: 'secondary-host-mismatch' | 'multiplex-same-host' | 'mouse-on-mouse' | 'serum-block-conflict';
  severity: 'warning' | 'suggestion';
  message: string;
  itemNames: string[];
}

function normalize(value: string | undefined): string | undefined {
  const cleaned = value?.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
  return cleaned || undefined;
}

/** The species a value names: "rabbit", "Rabbit IgG" and "guinea-pig" all give a species. */
export function speciesOf(value: string | undefined): string | undefined {
  const cleaned = normalize(value);
  if (!cleaned) return undefined;
  return (SPECIES as readonly string[]).find((s) => cleaned === s || cleaned.startsWith(`${s} `));
}

/** A secondary antibody is an antibody whose target is a species (anti-rabbit, anti-mouse IgG). */
export function isSecondary(item: CrossReactivityItem): boolean {
  return item.kind === 'antibody' && speciesOf(item.target) !== undefined;
}

function primaryHost(item: CrossReactivityItem): string | undefined {
  return item.kind === 'antibody' && !isSecondary(item) ? speciesOf(item.hostSpecies) : undefined;
}

/**
 * Checks an experiment's antibody set for likely cross-reactivity problems. Only antibody items are
 * considered. Returns an empty list when nothing is wrong.
 */
export function checkCrossReactivity(
  items: CrossReactivityItem[],
  options: CrossReactivityOptions = {},
): CrossReactivityWarning[] {
  const warnings: CrossReactivityWarning[] = [];
  const antibodies = items.filter((item) => item.kind === 'antibody');
  const secondaries = antibodies.filter(isSecondary);
  const primaries = antibodies.filter((item) => primaryHost(item) !== undefined);

  // A secondary must be raised against the host species of each primary it is paired with.
  for (const secondary of secondaries) {
    const targetSpecies = speciesOf(secondary.target)!;
    for (const primary of primaries) {
      const host = primaryHost(primary)!;
      if (host === targetSpecies) continue;
      warnings.push({
        code: 'secondary-host-mismatch',
        severity: 'warning',
        message: `${secondary.name} binds ${targetSpecies} immunoglobulin, but ${primary.name} is a ${host} antibody. It will not detect that primary.`,
        itemNames: [secondary.name, primary.name],
      });
    }
  }

  // Several primaries from one host cannot be told apart by species-specific secondaries.
  if (options.multiplex && secondaries.length > 0) {
    const byHost = new Map<string, CrossReactivityItem[]>();
    for (const primary of primaries) {
      const host = primaryHost(primary)!;
      byHost.set(host, [...(byHost.get(host) ?? []), primary]);
    }
    for (const [host, group] of byHost) {
      if (group.length < 2) continue;
      warnings.push({
        code: 'multiplex-same-host',
        severity: 'warning',
        message: `${group.length} primaries from ${host} are used together with species-specific secondaries. The secondaries cannot tell them apart. Use directly conjugated primaries or stain sequentially.`,
        itemNames: group.map((p) => p.name),
      });
    }
  }

  // Mouse primaries on mouse tissue pick up endogenous mouse immunoglobulin.
  if (speciesOf(options.tissueSpecies) === 'mouse') {
    const mousePrimaries = primaries.filter((p) => primaryHost(p) === 'mouse');
    if (mousePrimaries.length > 0) {
      warnings.push({
        code: 'mouse-on-mouse',
        severity: 'suggestion',
        message: 'Mouse primary on mouse tissue. Consider a Mouse-on-Mouse (M.O.M.) blocking step or an anti-mouse IgG Fab block.',
        itemNames: mousePrimaries.map((p) => p.name),
      });
    }
  }

  // An anti-X secondary stains the X serum that was used to block the sample.
  const blocking = speciesOf(options.blockingSerum);
  if (blocking) {
    for (const secondary of secondaries) {
      if (speciesOf(secondary.target) !== blocking) continue;
      warnings.push({
        code: 'serum-block-conflict',
        severity: 'warning',
        message: `${secondary.name} is anti-${blocking}, but the blocking serum is ${blocking} serum. The secondary will bind the blocking serum.`,
        itemNames: [secondary.name],
      });
    }
  }

  return warnings;
}
