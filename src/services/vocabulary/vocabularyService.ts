import { db, type VocabularyWord, type WordStatus } from '../../db/db';
import { initialReview, reviewForStatus, schedule, type Grade } from './srs';

export interface NewWord {
  language: 'fr' | 'en';
  word: string;
  lemma?: string;
  translations: string[];
  definition?: string;
  context?: string;
  bookId?: string;
  bookTitle?: string;
}

/** Clé d'unicité d'un mot : sa forme de base, en minuscules. */
export function wordKey(word: string, lemma?: string): string {
  return (lemma ?? word).trim().toLowerCase();
}

export function findWord(language: 'fr' | 'en', key: string): Promise<VocabularyWord | undefined> {
  return db.words.where('[language+key]').equals([language, key]).first();
}

/**
 * Enregistre un mot. S'il est déjà dans le vocabulaire, il est complété
 * (traductions, définition, contexte manquants) sans perdre sa progression.
 */
export async function saveWord(input: NewWord, now = Date.now()): Promise<VocabularyWord> {
  const key = wordKey(input.word, input.lemma);
  return db.transaction('rw', db.words, async () => {
    const existing = await findWord(input.language, key);
    if (existing) {
      const merged: VocabularyWord = {
        ...existing,
        translations: existing.translations.length > 0 ? existing.translations : input.translations,
        definition: existing.definition ?? input.definition,
        context: existing.context ?? input.context,
        updatedAt: now,
      };
      await db.words.put(merged);
      return merged;
    }
    const word: VocabularyWord = {
      ...input,
      ...initialReview(now),
      id: crypto.randomUUID(),
      key,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };
    await db.words.add(word);
    return word;
  });
}

export async function removeWord(id: string): Promise<void> {
  await db.words.delete(id);
}

/** Statut choisi à la main : la planification des révisions suit. */
export async function setWordStatus(id: string, status: WordStatus, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.words, async () => {
    const word = await db.words.get(id);
    if (!word) return;
    await db.words.put({ ...word, ...reviewForStatus(status, word, now), status, updatedAt: now });
  });
}

/** Enregistre une réponse de révision et renvoie le mot mis à jour. */
export async function recordReview(id: string, grade: Grade, now = Date.now()): Promise<VocabularyWord | undefined> {
  return db.transaction('rw', db.words, async () => {
    const word = await db.words.get(id);
    if (!word) return undefined;
    const updated = { ...word, ...schedule(word, grade, now), updatedAt: now };
    await db.words.put(updated);
    return updated;
  });
}

/** Mots à réviser maintenant, les plus en retard d'abord. */
export function getDueWords(now = Date.now(), limit = 20): Promise<VocabularyWord[]> {
  return db.words.where('dueAt').belowOrEqual(now).limit(limit).sortBy('dueAt');
}
