import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listAnimals, putAnimal } from '../../db/animals';
import { listCages, putCage, deleteCage } from '../../db/cages';
import { newId } from '../../db/helpers';
import type { Animal, AnimalSex, Cage } from '../../types';
import { BUTTON_LINK, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';
import { computeAge, formatAge, parseIsoDate } from './ageMath';
import { AnimalDetail } from './AnimalDetail';
import { CageCard } from './CageCard';
import { RridField } from '../neuro/RridField';

const SEX_LABEL: Record<AnimalSex, string> = { male: 'Male', female: 'Female', unknown: 'Unknown' };

export default function AnimalsPage() {
  const cages = useLiveQuery(() => listCages(db), [], []);
  const animals = useLiveQuery(() => listAnimals(undefined, db), [], []);
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [printCageId, setPrintCageId] = useState<string | undefined>(undefined);
  const cageById = new Map(cages.map((c) => [c.id, c]));
  const printCage = printCageId ? cageById.get(printCageId) : undefined;

  function printCard(cageId: string) {
    setPrintCageId(cageId);
    // Let React render the card into the print-only element before the print dialog opens.
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 pb-12 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Animals</h1>
        <p className="text-base text-text-muted">Cages, animals, weights, surgery and post-op checks.</p>
      </header>

      <section aria-label="Cages" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Cages</h2>
        {cages.length === 0 && <p className="text-base text-text-muted">No cages yet.</p>}
        <ul className="flex flex-col gap-2">
          {cages.map((cage) => {
            const housed = animals.filter((a) => a.cageId === cage.id);
            return (
              <li key={cage.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                <div className="flex flex-col">
                  <span className="text-lg font-medium">
                    Cage {cage.label} · Room {cage.room || '—'}
                  </span>
                  <span className="text-base text-text-muted">
                    {housed.length} {housed.length === 1 ? 'animal' : 'animals'}
                    {cage.notes ? ` · ${cage.notes}` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={BUTTON_SECONDARY} onClick={() => printCard(cage.id)}>
                    Print cage card
                  </button>
                  <button
                    type="button"
                    className={BUTTON_LINK}
                    onClick={() => {
                      if (window.confirm(`Delete cage ${cage.label}? Animals in it stay on record but become uncaged.`)) {
                        void deleteCage(cage.id, db);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <CageForm />
      </section>

      <section aria-label="Animals" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Animals</h2>
        {animals.length === 0 && <p className="text-base text-text-muted">No animals yet.</p>}
        <ul className="flex flex-col gap-3">
          {animals.map((animal) => {
            const open = openId === animal.id;
            return (
              <li key={animal.id} className="rounded-xl border border-border p-4">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? undefined : animal.id)}
                  className="flex min-h-12 w-full flex-col items-start text-left"
                >
                  <span className="text-lg font-semibold">{animal.label}</span>
                  <span className="text-base text-text-muted">
                    {animal.species || 'Species not set'} · {SEX_LABEL[animal.sex]} · {formatAge(animal.dob)}
                    {animal.genotype ? ` · ${animal.genotype}` : ''}
                    {animal.cageId && cageById.has(animal.cageId) ? ` · Cage ${cageById.get(animal.cageId)?.label}` : ''}
                  </span>
                </button>
                {open && <AnimalDetail animal={animal} cageLabel={cageLabelFor(animal, cageById)} />}
              </li>
            );
          })}
        </ul>
        <AnimalForm cages={cages} />
      </section>

      {printCage && <CageCard cage={printCage} animals={animals.filter((a) => a.cageId === printCage.id)} />}
    </main>
  );
}

function cageLabelFor(animal: Animal, cageById: Map<string, Cage>): string {
  const cage = animal.cageId ? cageById.get(animal.cageId) : undefined;
  return cage ? `${cage.label} (room ${cage.room || '—'})` : 'Not caged';
}

function CageForm() {
  const [label, setLabel] = useState('');
  const [room, setRoom] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  async function add() {
    if (!label.trim()) return setError('Enter a cage label.');
    setError(undefined);
    const now = Date.now();
    await putCage({ id: newId(), label: label.trim(), room: room.trim(), notes: notes.trim() || undefined, createdAt: now, updatedAt: now }, db);
    setLabel('');
    setRoom('');
    setNotes('');
  }

  return (
    <form
      aria-label="Add cage"
      className="grid gap-3 rounded-xl border border-dashed border-border-strong p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <h3 className="text-base font-semibold sm:col-span-2">Add cage</h3>
      <TextField label="Cage label" value={label} onChange={setLabel} />
      <TextField label="Room" value={room} onChange={setRoom} />
      <TextField label="Notes" value={notes} onChange={setNotes} className="sm:col-span-2" />
      {error && <p role="alert" className="text-base text-rose-700 dark:text-rose-300 sm:col-span-2">{error}</p>}
      <button type="submit" className={`${BUTTON_PRIMARY} sm:col-span-2 sm:w-fit`}>
        Add cage
      </button>
    </form>
  );
}

function AnimalForm({ cages }: { cages: Cage[] }) {
  const [label, setLabel] = useState('');
  const [cageId, setCageId] = useState('');
  const [species, setSpecies] = useState('Mouse');
  const [strain, setStrain] = useState('');
  const [genotype, setGenotype] = useState('');
  const [sex, setSex] = useState<AnimalSex>('unknown');
  const [dob, setDob] = useState('');
  const [rrid, setRrid] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  async function add() {
    if (!label.trim()) return setError('Enter an animal ID.');
    if (!parseIsoDate(dob) || computeAge(dob) === undefined) return setError('Enter a date of birth that is not in the future.');
    setError(undefined);
    const now = Date.now();
    const animal: Animal = {
      id: newId(),
      label: label.trim(),
      cageId: cageId || undefined,
      species: species.trim(),
      strain: strain.trim(),
      genotype: genotype.trim(),
      sex,
      dob,
      rrid: rrid.trim() || undefined,
      notes: notes.trim() || undefined,
      events: [],
      createdAt: now,
      updatedAt: now,
    };
    await putAnimal(animal, db);
    setLabel('');
    setGenotype('');
    setNotes('');
    setRrid('');
  }

  return (
    <form
      aria-label="Add animal"
      className="grid gap-3 rounded-xl border border-dashed border-border-strong p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <h3 className="text-base font-semibold sm:col-span-2">Add animal</h3>
      <TextField label="Animal ID" value={label} onChange={setLabel} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-muted">Cage</span>
        <select className={FIELD_INPUT} value={cageId} onChange={(e) => setCageId(e.target.value)}>
          <option value="">Not caged</option>
          {cages.map((c) => (
            <option key={c.id} value={c.id}>
              Cage {c.label}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Species" value={species} onChange={setSpecies} />
      <TextField label="Strain" value={strain} onChange={setStrain} />
      <TextField label="Genotype" value={genotype} onChange={setGenotype} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-muted">Sex</span>
        <select className={FIELD_INPUT} value={sex} onChange={(e) => setSex(e.target.value as AnimalSex)}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-muted">Date of birth</span>
        <input type="date" className={FIELD_INPUT} value={dob} onChange={(e) => setDob(e.target.value)} />
      </label>
      <div className="sm:col-span-2">
        <RridField id="animal-rrid" searchName={label || species} value={rrid} onChange={setRrid} />
      </div>
      <TextField label="Notes" value={notes} onChange={setNotes} className="sm:col-span-2" />
      {error && <p role="alert" className="text-base text-rose-700 dark:text-rose-300 sm:col-span-2">{error}</p>}
      <button type="submit" className={`${BUTTON_PRIMARY} sm:col-span-2 sm:w-fit`}>
        Add animal
      </button>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <input className={FIELD_INPUT} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
