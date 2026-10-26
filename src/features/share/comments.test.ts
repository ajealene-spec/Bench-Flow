import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { listComments } from '../../db/comments';
import { addComment, authorNameFrom, DEFAULT_AUTHOR } from './comments';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`comments-${crypto.randomUUID()}`);
  await database.open();
});

describe('authorNameFrom', () => {
  it('uses the settings name, trimmed, and falls back to Me', () => {
    expect(authorNameFrom('  Ana Lee ')).toBe('Ana Lee');
    expect(authorNameFrom('   ')).toBe(DEFAULT_AUTHOR);
    expect(authorNameFrom(undefined)).toBe(DEFAULT_AUTHOR);
  });
});

describe('addComment author', () => {
  it('stores the name it is given as the author', async () => {
    await addComment({ targetType: 'experiment', targetId: 'e1', author: authorNameFrom('Ana Lee'), text: 'Looks good' }, database);
    const [comment] = await listComments({ targetType: 'experiment', targetId: 'e1' }, database);
    expect(comment.author).toBe('Ana Lee');
  });
});
