import { db, type Progress, type ReaderPosition } from '../db/db';
import { clamp01 } from './progress';

function emptyProgress(bookId: string): Progress {
  return { bookId, percentage: 0, totalReadingMs: 0, updatedAt: Date.now() };
}

export function getProgress(bookId: string): Promise<Progress | undefined> {
  return db.progress.get(bookId);
}

/**
 * Enregistre la position courante. Sans `percentage` (repères EPUB pas encore
 * calculés), l'avancement précédent est conservé.
 */
export async function savePosition(bookId: string, position: ReaderPosition, percentage?: number): Promise<void> {
  await db.transaction('rw', db.progress, async () => {
    const current = (await db.progress.get(bookId)) ?? emptyProgress(bookId);
    await db.progress.put({
      ...current,
      position,
      percentage: percentage === undefined ? current.percentage : clamp01(percentage),
      updatedAt: Date.now(),
    });
  });
}

/**
 * Ajoute du temps de lecture à la session en cours (créée si `sessionId` est
 * absent) et au total du livre. Renvoie l'identifiant de la session.
 */
export async function addReadingTime(
  bookId: string,
  sessionId: number | undefined,
  deltaMs: number,
  now = Date.now(),
): Promise<number> {
  return db.transaction('rw', db.progress, db.readingSessions, async () => {
    const session = sessionId === undefined ? undefined : await db.readingSessions.get(sessionId);
    let id: number;
    if (session?.id !== undefined) {
      id = session.id;
      await db.readingSessions.update(id, { endedAt: now, durationMs: session.durationMs + deltaMs });
    } else {
      const newId = await db.readingSessions.add({
        bookId,
        startedAt: now - deltaMs,
        endedAt: now,
        durationMs: deltaMs,
      });
      if (newId === undefined) throw new Error('Session de lecture non créée');
      id = newId;
    }

    const current = (await db.progress.get(bookId)) ?? emptyProgress(bookId);
    await db.progress.put({ ...current, totalReadingMs: current.totalReadingMs + deltaMs });
    return id;
  });
}

export async function getEpubLocations(bookId: string): Promise<string | undefined> {
  return (await db.epubLocations.get(bookId))?.locations;
}

export async function saveEpubLocations(bookId: string, locations: string): Promise<void> {
  await db.epubLocations.put({ bookId, locations });
}
