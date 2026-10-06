import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { deleteBook } from './bookService';
import { addHighlight, deleteHighlight, getHighlights, updateHighlight } from './highlightService';

const BOOK_ID = 'livre-test';
const anchor = { format: 'pdf', page: 1, rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.02 }] } as const;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('highlightService', () => {
  it('ajoute un surlignage avec identifiant et dates', async () => {
    const created = await addHighlight({ bookId: BOOK_ID, anchor, text: 'Bonjour', color: 'yellow' });
    expect(created.id).toBeTruthy();
    expect(await getHighlights(BOOK_ID)).toEqual([created]);
  });

  it('change la couleur et la note', async () => {
    const { id } = await addHighlight({ bookId: BOOK_ID, anchor, text: 'Bonjour', color: 'yellow' });
    await updateHighlight(id, { color: 'blue', note: '  Important  ' });
    const [updated] = await getHighlights(BOOK_ID);
    expect(updated.color).toBe('blue');
    expect(updated.note).toBe('Important');
  });

  it('supprime la note quand elle est vidée', async () => {
    const { id } = await addHighlight({ bookId: BOOK_ID, anchor, text: 'Bonjour', color: 'yellow' });
    await updateHighlight(id, { note: 'Une note' });
    await updateHighlight(id, { note: '   ' });
    const [updated] = await getHighlights(BOOK_ID);
    expect(updated.note).toBeUndefined();
  });

  it('supprime un surlignage', async () => {
    const { id } = await addHighlight({ bookId: BOOK_ID, anchor, text: 'Bonjour', color: 'yellow' });
    await deleteHighlight(id);
    expect(await getHighlights(BOOK_ID)).toEqual([]);
  });

  it('supprime les surlignages avec le livre', async () => {
    await addHighlight({ bookId: BOOK_ID, anchor, text: 'A', color: 'yellow' });
    await addHighlight({ bookId: 'autre', anchor, text: 'B', color: 'yellow' });
    await deleteBook(BOOK_ID);
    expect(await getHighlights(BOOK_ID)).toEqual([]);
    expect(await getHighlights('autre')).toHaveLength(1);
  });
});
