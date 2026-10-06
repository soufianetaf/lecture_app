import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { base64ToBlob, BackupError, blobToBase64, createBackup, readBackup, restoreBackup } from './backup';
import { addHighlight } from './highlightService';
import { savePosition } from './progressService';
import { saveWord } from './vocabulary/vocabularyService';

const bookFile = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x80])], { type: 'application/pdf' });

async function seed() {
  await db.books.add({
    id: 'livre-1',
    title: 'Le Jardin',
    author: 'Marie',
    language: 'fr',
    format: 'pdf',
    file: bookFile,
    fileName: 'jardin.pdf',
    size: bookFile.size,
    cover: new Blob(['jpeg'], { type: 'image/jpeg' }),
    addedAt: 1,
  });
  await savePosition('livre-1', { format: 'pdf', page: 4 }, 0.4);
  await addHighlight({
    bookId: 'livre-1',
    anchor: { format: 'pdf', page: 1, rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.02 }] },
    text: 'Bonjour',
    color: 'green',
  });
  await saveWord({ language: 'fr', word: 'maison', translations: ['house'], bookId: 'livre-1' }, 1);
  await db.settings.put({
    id: 'app',
    theme: 'sepia',
    fontFamily: 'serif',
    fontSize: 120,
    lineHeight: 1.6,
    columnWidth: 'medium',
    pdfZoom: 1,
  });
  await db.dictCache.put({ key: 'v4:def:fr:maison', value: null, expiresAt: Date.now() + 1000 });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('base64', () => {
  it('fait l’aller-retour d’un fichier binaire', async () => {
    const restored = base64ToBlob(await blobToBase64(bookFile), bookFile.type);
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array(await bookFile.arrayBuffer()));
    expect(restored.type).toBe('application/pdf');
  });
});

describe('sauvegarde et restauration', () => {
  it('restaure toutes les données à l’identique sur un navigateur vide', async () => {
    await seed();
    const backup = await createBackup();

    await db.delete();
    await db.open();
    const summary = await restoreBackup(backup);

    expect(summary).toMatchObject({ books: 1, progress: 1, highlights: 1, words: 1, settings: 1 });
    const book = await db.books.get('livre-1');
    expect(new Uint8Array(await book!.file.arrayBuffer())).toEqual(new Uint8Array(await bookFile.arrayBuffer()));
    expect(await book!.cover!.text()).toBe('jpeg');
    expect((await db.progress.get('livre-1'))?.position).toEqual({ format: 'pdf', page: 4 });
    expect((await db.highlights.toArray())[0].color).toBe('green');
    expect((await db.settings.get('app'))?.theme).toBe('sepia');
  });

  it('n’inclut pas le cache du dictionnaire', async () => {
    await seed();
    const json = JSON.parse(await (await createBackup()).text());
    expect(json.tables.dictCache).toBeUndefined();
    expect(json.format).toBe('lecture-backup');
  });

  it('fusionne sans effacer les données locales, et peut être restaurée deux fois', async () => {
    await seed();
    const backup = await createBackup();
    await saveWord({ language: 'en', word: 'house', translations: ['maison'] }, 2);

    await restoreBackup(backup);
    await restoreBackup(backup);

    expect(await db.words.count()).toBe(2); // « house » local conservé, « maison » non dupliqué
    expect(await db.books.count()).toBe(1);
  });

  it('remplace un mot existant sous un autre identifiant (index unique)', async () => {
    await seed();
    const backup = await createBackup();
    await db.words.clear();
    await saveWord({ language: 'fr', word: 'maison', translations: [] }, 5); // autre id

    await restoreBackup(backup);

    const words = await db.words.toArray();
    expect(words).toHaveLength(1);
    expect(words[0].translations).toEqual(['house']);
  });
});

describe('readBackup', () => {
  const file = (content: string) => new Blob([content], { type: 'application/json' });

  it('refuse un fichier qui n’est pas du JSON', async () => {
    await expect(readBackup(file('pas du json'))).rejects.toBeInstanceOf(BackupError);
  });

  it('refuse un JSON qui n’est pas une sauvegarde', async () => {
    await expect(readBackup(file('{"hello":1}'))).rejects.toMatchObject({ code: 'notBackup' });
  });

  it('refuse une sauvegarde d’une version plus récente', async () => {
    await expect(readBackup(file('{"format":"lecture-backup","version":99,"tables":{}}'))).rejects.toMatchObject({
      code: 'newerVersion',
    });
  });

  it('refuse une table corrompue sans rien modifier', async () => {
    await seed();
    const corrupted = file('{"format":"lecture-backup","version":1,"tables":{"books":"oops"}}');
    await expect(restoreBackup(corrupted)).rejects.toMatchObject({ code: 'corrupted' });
    expect(await db.books.count()).toBe(1);
  });
});
