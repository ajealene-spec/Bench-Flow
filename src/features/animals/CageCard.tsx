import type { Animal, Cage } from '../../types';
import { formatAge } from './ageMath';

/**
 * Printable cage card: cage, room, and each animal's ID, sex, genotype and age. Hidden on screen and shown only
 * when printing (see the print button on the animals page).
 */
export function CageCard({ cage, animals }: { cage: Cage; animals: Animal[] }) {
  return (
    <article
      aria-label={`Cage card ${cage.label}`}
      className="hidden print:fixed print:inset-0 print:z-[1000] print:block print:bg-surface shadow-card print:p-10 print:text-text"
    >
      <header className="flex items-baseline justify-between border-b-4 border-black pb-3">
        <h1 className="text-5xl font-bold">Cage {cage.label}</h1>
        <span className="text-2xl">Room {cage.room || '—'}</span>
      </header>
      {cage.notes && <p className="mt-4 text-xl">{cage.notes}</p>}
      <table className="mt-6 w-full border-collapse text-left text-xl">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2">ID</th>
            <th className="py-2">Sex</th>
            <th className="py-2">Genotype</th>
            <th className="py-2">Age</th>
          </tr>
        </thead>
        <tbody>
          {animals.map((a) => (
            <tr key={a.id} className="border-b border-border-strong">
              <td className="py-3 font-semibold">{a.label}</td>
              <td className="py-3">{a.sex}</td>
              <td className="py-3">{a.genotype || '—'}</td>
              <td className="py-3">{formatAge(a.dob)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-10 text-lg">Checked by: ____________________ &nbsp; Date: ____________</p>
    </article>
  );
}
