import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { deleteGlossaryTerm, listGlossary, putGlossaryTerm } from '../../db/glossary';
import { BUILTIN_TERMS } from './glossaryData';
import { findGlossaryEntry } from './glossaryMatch';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';

interface Row {
  key: string;
  term: string;
  definition: string;
  aliases: string[];
  userId?: string;
}

/** Glossary with search, built-in terms and the user's own. */
export default function GlossaryPage() {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const userTerms = useLiveQuery(() => listGlossary(db), []) ?? [];

  const userRows: Row[] = userTerms.map((t) => ({ key: `u-${t.id}`, term: t.term, definition: t.definition, aliases: [], userId: t.id }));
  const builtinRows: Row[] = BUILTIN_TERMS.filter((b) => !userTerms.some((u) => u.term.toLowerCase() === b.term.toLowerCase())).map((b) => ({
    key: `b-${b.term}`,
    term: b.term,
    definition: b.definition,
    aliases: b.aliases ?? [],
  }));
  const q = query.trim().toLowerCase();
  const rows = [...userRows, ...builtinRows]
    .filter((r) => !q || [r.term, r.definition, ...r.aliases].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => a.term.localeCompare(b.term));

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = term.trim();
    const d = definition.trim();
    if (!t || !d) {
      setMessage('Enter a term and a definition.');
      return;
    }
    if (findGlossaryEntry(t, BUILTIN_TERMS) && !userTerms.some((u) => u.term.toLowerCase() === t.toLowerCase())) {
      setMessage('That term is already built in. Your definition will replace it.');
    }
    const now = Date.now();
    await putGlossaryTerm({ id: crypto.randomUUID(), term: t, definition: d, createdAt: now, updatedAt: now }, db);
    setTerm('');
    setDefinition('');
    setMessage(`Added ${t}.`);
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete your term "${name}"?`)) return;
    await deleteGlossaryTerm(id, db);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Glossary</h1>
      <label className="flex flex-col gap-1 text-base font-medium">
        Search terms
        <input type="search" className={FIELD_INPUT} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example TBST, bregma, IACUC" />
      </label>
      <ul aria-label="Glossary terms" className="flex flex-col gap-2">
        {rows.length === 0 && <li className="text-base text-text-muted">No matching terms.</li>}
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-1 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{r.term}</span>
              {r.userId ? (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-sm">Your term</span>
              ) : null}
              {r.userId && (
                <button type="button" className={`${BUTTON_SECONDARY} ml-auto`} onClick={() => void remove(r.userId!, r.term)}>
                  Delete
                </button>
              )}
            </div>
            <p className="text-base leading-relaxed">{r.definition}</p>
            {r.aliases.length > 0 && <p className="text-sm text-text-muted">Also: {r.aliases.join(',')}</p>}
          </li>
        ))}
      </ul>

      <form onSubmit={add} aria-label="Add a term" className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <h2 className="text-xl font-semibold">Add your own term</h2>
        <label className="flex flex-col gap-1 text-base font-medium">
          Term
          <input className={FIELD_INPUT} value={term} onChange={(e) => setTerm(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-base font-medium">
          Definition
          <textarea className={`${FIELD_INPUT} min-h-24 py-2`} value={definition} onChange={(e) => setDefinition(e.target.value)} />
        </label>
        <div>
          <button type="submit" className={BUTTON_PRIMARY}>
            Add term
          </button>
        </div>
        {message && <p role="status" className="text-base">{message}</p>}
      </form>
    </main>
  );
}
