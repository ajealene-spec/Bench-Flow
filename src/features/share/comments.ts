import { db as defaultDb, type LabCompanionDB } from '../../db';
import { deleteComment, getComment, putComment } from '../../db/comments';
import type { CommentTargetType, TargetComment } from '../../types';

const AUTHOR_KEY = 'benchflow.authorName';
export const DEFAULT_AUTHOR = 'Me';

/**
 * The name shown on comments. Settings have no name field yet, so the name is remembered in this
 * browser only. Falls back to "Me" when storage is blocked or nothing was set.
 */
export function getAuthorName(): string {
  try {
    return window.localStorage.getItem(AUTHOR_KEY)?.trim() || DEFAULT_AUTHOR;
  } catch {
    return DEFAULT_AUTHOR;
  }
}

export function setAuthorName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) window.localStorage.setItem(AUTHOR_KEY, trimmed);
    else window.localStorage.removeItem(AUTHOR_KEY);
  } catch {
    // Storage blocked: the name simply is not remembered.
  }
}

export interface NewComment {
  targetType: CommentTargetType;
  targetId: string;
  author: string;
  text: string;
}

/** Adds a comment. Blank text is rejected so empty threads never appear. */
export async function addComment(input: NewComment, database: LabCompanionDB = defaultDb): Promise<TargetComment> {
  const text = input.text.trim();
  if (!text) throw new Error('Write a comment before adding it.');
  const comment: TargetComment = {
    id: crypto.randomUUID(),
    targetType: input.targetType,
    targetId: input.targetId,
    author: input.author.trim() || DEFAULT_AUTHOR,
    text,
    createdAt: Date.now(),
    resolved: false,
  };
  await putComment(comment, database);
  return comment;
}

export async function setCommentResolved(id: string, resolved: boolean, database: LabCompanionDB = defaultDb): Promise<void> {
  const comment = await getComment(id, database);
  if (comment) await putComment({ ...comment, resolved }, database);
}

export function removeComment(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  return deleteComment(id, database);
}
