import type { Animal, AnimalEvent, AnimalEventKind } from '../../types';
import { newId } from '../../db/helpers';

/** Returns the animal with one event added, newest last. Pure, so the record stays a single document. */
export function withEvent(animal: Animal, event: Omit<AnimalEvent, 'id'>, now = Date.now()): Animal {
  return {
    ...animal,
    events: [...animal.events, { id: newId(), ...event }].sort((a, b) => a.at - b.at),
    updatedAt: now,
  };
}

export function weightSeries(animal: Animal): { at: number; value: number }[] {
  return animal.events
    .filter((e): e is AnimalEvent & { value: number } => e.kind === 'weight' && typeof e.value === 'number')
    .map((e) => ({ at: e.at, value: e.value }))
    .sort((a, b) => a.at - b.at);
}

/** Events of a kind, newest first. */
export function eventsOfKind(animal: Animal, kind: AnimalEventKind): AnimalEvent[] {
  return animal.events.filter((e) => e.kind === kind).sort((a, b) => b.at - a.at);
}
