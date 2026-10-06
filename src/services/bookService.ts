import { db } from '../db/db';

/** Supprime un livre et toutes ses données liées, en une seule transaction. */
export async function deleteBook(bookId: string): Promise<void> {
  await db.transaction('rw', [db.books, db.progress, db.readingSessions, db.epubLocations], async () => {
    await db.books.delete(bookId);
    await db.progress.delete(bookId);
    await db.readingSessions.where('bookId').equals(bookId).delete();
    await db.epubLocations.delete(bookId);
  });
}
