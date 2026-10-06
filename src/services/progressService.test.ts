import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { deleteBook } from './bookService';
import { addReadingTime, getEpubLocations, getProgress, saveEpubLocations, savePosition } from './progressService';

const BOOK_ID = 'livre-test';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('savePosition', () => {
  it('crée la progression au premier enregistrement', async () => {
    await savePosition(BOOK_ID, { format: 'pdf', page: 3 }, 0.1);
    const progress = await getProgress(BOOK_ID);
    expect(progress?.position).toEqual({ format: 'pdf', page: 3 });
    expect(progress?.percentage).toBe(0.1);
    expect(progress?.totalReadingMs).toBe(0);
  });

  it("garde l'avancement précédent quand il est inconnu", async () => {
    await savePosition(BOOK_ID, { format: 'epub', cfi: 'epubcfi(/6/2)' }, 0.4);
    await savePosition(BOOK_ID, { format: 'epub', cfi: 'epubcfi(/6/4)' });
    const progress = await getProgress(BOOK_ID);
    expect(progress?.position).toEqual({ format: 'epub', cfi: 'epubcfi(/6/4)' });
    expect(progress?.percentage).toBe(0.4);
  });

  it('borne un avancement hors limites', async () => {
    await savePosition(BOOK_ID, { format: 'pdf', page: 1 }, 1.7);
    expect((await getProgress(BOOK_ID))?.percentage).toBe(1);
  });

  it('conserve le temps de lecture déjà compté', async () => {
    await addReadingTime(BOOK_ID, undefined, 30_000);
    await savePosition(BOOK_ID, { format: 'pdf', page: 2 }, 0.2);
    expect((await getProgress(BOOK_ID))?.totalReadingMs).toBe(30_000);
  });
});

describe('addReadingTime', () => {
  it('crée une session puis la prolonge', async () => {
    const id = await addReadingTime(BOOK_ID, undefined, 15_000, 1_000_000);
    const sameId = await addReadingTime(BOOK_ID, id, 15_000, 1_015_000);

    expect(sameId).toBe(id);
    const sessions = await db.readingSessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ startedAt: 985_000, endedAt: 1_015_000, durationMs: 30_000 });
    expect((await getProgress(BOOK_ID))?.totalReadingMs).toBe(30_000);
  });

  it("additionne les sessions d'un même livre", async () => {
    await addReadingTime(BOOK_ID, undefined, 60_000);
    await addReadingTime(BOOK_ID, undefined, 120_000);
    expect(await db.readingSessions.count()).toBe(2);
    expect((await getProgress(BOOK_ID))?.totalReadingMs).toBe(180_000);
  });
});

describe('deleteBook', () => {
  it('supprime le livre et toutes ses données liées', async () => {
    await db.books.add({
      id: BOOK_ID,
      title: 'Test',
      author: 'Auteur',
      language: 'fr',
      format: 'epub',
      file: new Blob(['x']),
      fileName: 'test.epub',
      size: 1,
      addedAt: Date.now(),
    });
    await savePosition(BOOK_ID, { format: 'epub', cfi: 'epubcfi(/6/2)' }, 0.5);
    await addReadingTime(BOOK_ID, undefined, 10_000);
    await saveEpubLocations(BOOK_ID, '[]');
    await addReadingTime('autre-livre', undefined, 10_000);

    await deleteBook(BOOK_ID);

    expect(await db.books.get(BOOK_ID)).toBeUndefined();
    expect(await getProgress(BOOK_ID)).toBeUndefined();
    expect(await getEpubLocations(BOOK_ID)).toBeUndefined();
    expect(await db.readingSessions.where('bookId').equals(BOOK_ID).count()).toBe(0);
    // Les données des autres livres sont intactes.
    expect(await db.readingSessions.where('bookId').equals('autre-livre').count()).toBe(1);
  });
});
