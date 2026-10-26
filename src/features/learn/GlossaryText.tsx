import { useState } from 'react';
import { splitGlossary, type GlossaryEntry } from './glossaryMatch';
import { useGlossaryEntries } from './useLearnData';

/** Plain text where known terms are underlined. Tapping one opens its definition. */
export function GlossaryText({ text, entries }: { text: string; entries?: GlossaryEntry[] }) {
  const allEntries = useGlossaryEntries();
  const segments = splitGlossary(text, entries ?? allEntries);
  return (
    <>
      {segments.map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <GlossaryTermButton key={i} label={s.text} term={s.entry.term} definition={s.entry.definition} />
        ),
      )}
    </>
  );
}

/** One underlined term with a popover. The tap target is 48px tall. */
export function GlossaryTermButton({ label, term, definition }: { label: string; term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${term}: definition`}
        onClick={() => setOpen((v) => !v)}
        className="inline-block min-h-12 underline decoration-dotted underline-offset-4 decoration-2 align-middle"
      >
        {label}
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={`Definition of ${term}`}
          className="absolute left-0 top-full z-30 mt-1 flex w-72 max-w-[85vw] flex-col gap-2 rounded-xl border border-border bg-surface shadow-card p-4 text-left text-base font-normal text-text shadow-lg"
        >
          <span className="font-semibold">{term}</span>
          <span className="text-base leading-snug">{definition}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-12 self-end rounded-xl border border-border px-4 text-base font-medium"
          >
            Close
          </button>
        </span>
      )}
    </span>
  );
}
