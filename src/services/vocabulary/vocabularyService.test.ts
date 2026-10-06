import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { deleteBook } from '../bookService';
import { findWord, getDueWords, recordReview, removeWord, saveWord, setWordStatus, wordKey } from './vocabularyService';

const NOW = Date.UTC(2026, 9, 6);
const DAY = 24 * 60 * 60 * 1000;

const ran = {
  language: 'en' as const,
  word: 'ran',
  lemma: 'run',
  translations: ['courir'],
  definition: 'To move swiftly.',
  context: 'She ran to the gate.',
  bookId: 'livre-1',
  bookTitle: 'The Empty House',
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('wordKey', () => {
  it('utilise la forme de base en minuscules', () => {
    expect(wordKey('Ran', 'Run')).toBe('run');
    expect(wordKey('Maison')).toBe('maison');
  });
});

describe('saveWord', () => {
  it('enregistre un nouveau mot, à réviser tout de suite', async () => {
    const saved = await saveWord(ran, NOW);
    expect(saved).toMatchObject({ key: 'run', status: 'new', dueAt: NOW, context: 'She ran to the gate.' });
    expect(await findWord('en', 'run')).toEqual(saved);
  });

  it('ne crée pas de doublon et garde la progression', async () => {
    const first = await saveWord(ran, NOW);
    await recordReview(first.id, 'good', NOW);
    const again = await saveWord({ ...ran, word: 'runs', context: 'He runs.' }, NOW + DAY);

    expect(await db.words.count()).toBe(1);
    expect(again.id).toBe(first.id);
    expect(again.repetitions).toBe(1);
    expect(again.context).toBe('She ran to the gate.'); // le premier contexte est conservé
  });

  it('complète les informations manquantes', async () => {
    await saveWord({ ...ran, translations: [], definition: undefined }, NOW);
    const completed = await saveWord(ran, NOW);
    expect(completed.translations).toEqual(['courir']);
    expect(completed.definition).toBe('To move swiftly.');
  });

  it('distingue les langues', async () => {
    await saveWord({ ...ran, language: 'en', word: 'pain', lemma: undefined }, NOW);
    await saveWord({ ...ran, language: 'fr', word: 'pain', lemma: undefined }, NOW);
    expect(await db.words.count()).toBe(2);
  });
});

describe('révisions', () => {
  it('met à jour statut et prochaine date après une réponse', async () => {
    const { id } = await saveWord(ran, NOW);
    const updated = await recordReview(id, 'good', NOW);
    expect(updated).toMatchObject({ status: 'learning', intervalDays: 1, dueAt: NOW + DAY, lastReviewedAt: NOW });
  });

  it('ne propose que les mots arrivés à échéance, les plus en retard d’abord', async () => {
    const a = await saveWord({ ...ran, word: 'a', lemma: undefined }, NOW - 2 * DAY);
    const b = await saveWord({ ...ran, word: 'b', lemma: undefined }, NOW - DAY);
    const c = await saveWord({ ...ran, word: 'c', lemma: undefined }, NOW);
    await recordReview(c.id, 'good', NOW); // c revient demain

    const due = await getDueWords(NOW);
    expect(due.map((w) => w.id)).toEqual([a.id, b.id]);
  });

  it('applique un statut choisi à la main', async () => {
    const { id } = await saveWord(ran, NOW);
    await setWordStatus(id, 'known', NOW);
    const word = await db.words.get(id);
    expect(word?.status).toBe('known');
    expect(word?.dueAt).toBe(NOW + 21 * DAY);
  });
});

describe('suppression', () => {
  it('supprime un mot', async () => {
    const { id } = await saveWord(ran, NOW);
    await removeWord(id);
    expect(await db.words.count()).toBe(0);
  });

  it('garde le vocabulaire quand le livre est supprimé', async () => {
    await saveWord(ran, NOW);
    await deleteBook('livre-1');
    expect(await findWord('en', 'run')).toMatchObject({ bookTitle: 'The Empty House' });
  });
});
