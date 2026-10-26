import { useState } from 'react';
import { db } from '../../db';
import { addTag, normalizeTag } from './experimentList';
import { setExperimentTags } from './experimentActions';
import { BUTTON_SECONDARY, INPUT, LABEL } from './styles';

/** Tag chips for one run. Each chip has its own remove button; Enter adds the typed tag. */
export function TagEditor({ experimentId, tags }: { experimentId: string; tags: string[] }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save(next: string[]) {
    setError(null);
    try {
      await setExperimentTags(experimentId, next, db);
    } catch {
      setError('Could not save the tags. Please try again.');
    }
  }

  function add() {
    const next = addTag(tags, text);
    setText('');
    if (normalizeTag(text) && next !== tags) void save(next);
  }

  return (
    <section aria-label="Tags" className="flex flex-col gap-3">
      <span className="font-medium">Tags</span>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex min-h-12 items-center gap-1 rounded-full border border-border bg-surface-2 pl-4 text-text">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  className="inline-flex size-12 items-center justify-center rounded-full text-text-muted active:bg-surface"
                  onClick={() => void save(tags.filter((t) => t !== tag))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">No tags yet.</p>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className={`${LABEL} flex-1`}>
          <span className="sr-only">New tag</span>
          <input className={INPUT} value={text} placeholder="Add a tag" onChange={(e) => setText(e.target.value)} />
        </label>
        <button type="submit" className={BUTTON_SECONDARY}>
          Add tag
        </button>
      </form>
      {error && (
        <p role="alert" className="text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
    </section>
  );
}
