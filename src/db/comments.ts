import { db as defaultDb, type LabCompanionDB } from './index';
import type { CommentTargetType, TargetComment } from '../types';

/** Comments on one target, oldest first. Pass nothing to list every comment. */
export async function listComments(
  target?: { targetType: CommentTargetType; targetId: string },
  database: LabCompanionDB = defaultDb,
): Promise<TargetComment[]> {
  if (target === undefined) return database.comments.orderBy('createdAt').toArray();
  return database.comments
    .where('[targetType+targetId]')
    .equals([target.targetType, target.targetId])
    .sortBy('createdAt');
}

export function getComment(id: string, database: LabCompanionDB = defaultDb): Promise<TargetComment | undefined> {
  return database.comments.get(id);
}

export async function putComment(comment: TargetComment, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.comments.put(comment);
}

export async function deleteComment(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.comments.delete(id);
}
