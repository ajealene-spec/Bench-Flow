import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listComments } from '../../db/comments';
import type { CommentTargetType } from '../../types';
import { formatTimestamp } from '../data/time';
import { getSettings } from '../../db/settings';
import { addComment, authorNameFrom, removeComment, setCommentResolved } from './comments';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_SECONDARY =`${BUTTON} border border-border bg-surface shadow-card text-text active:bg-surface-2`;

interface CommentThreadProps {
  targetType: CommentTargetType;
  targetId: string;
  /** Label for screen readers and the heading, for example "Step 3: Lyse cells". */
  label: string;
}

/** Comments on one template, step or experiment, with add, resolve and delete. */
export function CommentThread({ targetType, targetId, label }: CommentThreadProps) {
  const comments = useLiveQuery(() => listComments({ targetType, targetId }, db), [targetType, targetId]);
  const [text, setText] = useState('');
  // The author is the name from Settings. It is read live, so a change there applies to the next comment.
  const settings = useLiveQuery(() => getSettings(db), []);
  const author = authorNameFrom(settings?.userName);
  const [error, setError] = useState<string | null>(null);

  if (comments === undefined) return <p className="text-sm text-text-muted">Loading comments…</p>;
  const open = comments.filter((c) => !c.resolved).length;

  async function add() {
    setError(null);
    try {
      await addComment({ targetType, targetId, author, text }, db);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the comment.');
    }
  }

  return (
    <section aria-label={`Comments on ${label}`} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold">Comments</h3>
        <span
          className="rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium text-text"
          aria-label={`${comments.length} comments, ${open} open`}
        >
          {comments.length}
          {open > 0 && open !== comments.length ? ` (${open} open)` : ''}
        </span>
      </div>

      {comments.length === 0 && <p className="text-sm text-text-muted">No comments yet.</p>}

      <ul className="flex flex-col gap-2">
        {comments.map((c) => (
          <li
            key={c.id}
            className={`flex flex-col gap-2 rounded-xl border p-3 ${c.resolved ?'border-border opacity-70' :'border-border'}`}
          >
            <p className="text-sm text-text-muted">
              <strong className="text-text">{c.author}</strong> · {formatTimestamp(c.createdAt)}
              {c.resolved ? ' · resolved' : ''}
            </p>
            <p className="whitespace-pre-line text-base">{c.text}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BUTTON_SECONDARY} onClick={() => void setCommentResolved(c.id, !c.resolved, db)}>
                {c.resolved ? 'Reopen' : 'Resolve'}
              </button>
              <button
                type="button"
                className={BUTTON_SECONDARY}
                onClick={() => {
                  if (window.confirm('Delete this comment?')) void removeComment(c.id, db);
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">
          Commenting as <strong className="text-text">{author}</strong>. Change your name in Settings.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">New comment on {label}</span>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-24 rounded-lg border border-border bg-surface shadow-card p-3 text-base"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        <div>
          <button type="button" className={BUTTON_SECONDARY} disabled={!text.trim()} onClick={() => void add()}>
            Add comment
          </button>
        </div>
      </div>
    </section>
  );
}
