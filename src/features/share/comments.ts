import { db as defaultDb, type LabCompanionDB } from '../../db';
import { deleteComment, getComment, putComment } from '../../db/comments';
import type { CommentTargetType, TargetComment } from '../../types';

export const DEFAULT_AUTHOR = 'Me';

/** The name shown on comments: the name from Settings, or "Me" when none is set. */
export function authorNameFrom(userName: string | undefined): string {
  return userName?.trim() || DEFAULT_AUTHOR;
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
    author: authorNameFrom(input.author),
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
