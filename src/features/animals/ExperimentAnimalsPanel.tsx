import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { listAnimals } from '../../db/animals';
import { updateExperiment } from '../../db/helpers';
import type { Experiment } from '../../types';

/**
 * Multi-select of the animals used in this run. Each animal is a full-width row (48px or taller) so it is easy
 * to tap with gloves. Saves on every change. Animals are managed on the Animals page.
 */
export function ExperimentAnimalsPanel({ experiment }: { experiment: Experiment }) {
  const animals = useLiveQuery(() => listAnimals(undefined, db), [], []);
  const selected = new Set(experiment.animalIds ?? []);

  function toggle(id: string, on: boolean) {
    const next = on ? [...selected, id] : [...selected].filter((a) => a !== id);
    void updateExperiment(experiment.id, { animalIds: next }, db);
  }

  return (
    <section aria-label="Animals used" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface shadow-card p-4">
      <h2 className="text-lg font-semibold">Animals used</h2>
      {animals.length === 0 ? (
        <p className="text-base text-text-muted">
          No animals yet. <Link to="/animals" className="underline">Add animals on the Animals page</Link>.
        </p>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Choose the animals used in this run</legend>
          {animals.map((animal) => (
            <label key={animal.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
              <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={selected.has(animal.id)} onChange={(e) => toggle(animal.id, e.target.checked)} />
              <span className="flex flex-col">
                <span className="font-medium">{animal.label}</span>
                <span className="text-sm text-text-muted">{[animal.species, animal.strain, animal.genotype].filter(Boolean).join(' · ') || 'No details'}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}
