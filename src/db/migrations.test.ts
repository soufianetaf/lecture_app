import { Dexie } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from './db';

afterEach(async () => {
  db.close();
  await Dexie.delete('lecture');
  await db.open();
});

describe('migration v7', () => {
  it('vide l’auteur « Auteur inconnu » enregistré par les anciennes versions', async () => {
    db.close();
    await Dexie.delete('lecture');

    // Base créée par la version 6 de l'application, avec deux livres.
    const v6 = new Dexie('lecture');
    v6.version(6).stores({ books: 'id, title, author, addedAt, lastOpenedAt, [fileName+size]' });
    await v6.table('books').bulkAdd([
      { id: 'a', title: 'Sans auteur', author: 'Auteur inconnu' },
      { id: 'b', title: 'Avec auteur', author: 'Marie Dupont' },
    ]);
    v6.close();

    await db.open(); // déclenche la mise à niveau vers la dernière version
    expect((await db.books.get('a'))?.author).toBe('');
    expect((await db.books.get('b'))?.author).toBe('Marie Dupont');
  });
});
