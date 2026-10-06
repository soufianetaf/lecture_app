import { describe, expect, it } from 'vitest';
import type { VocabularyWord } from '../../db/db';
import { csvField, wordsToAnkiCsv } from './ankiExport';
import { initialReview } from './srs';

function word(partial: Partial<VocabularyWord>): VocabularyWord {
  return {
    ...initialReview(0),
    id: '1',
    key: 'run',
    language: 'en',
    word: 'ran',
    translations: [],
    status: 'new',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('csvField', () => {
  it('protège virgules, guillemets et retours à la ligne', () => {
    expect(csvField('simple')).toBe('simple');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('il dit "oui"')).toBe('"il dit ""oui"""');
    expect(csvField('ligne\nsuivante')).toBe('"ligne\nsuivante"');
  });
});

describe('wordsToAnkiCsv', () => {
  it('produit les en-têtes Anki et une ligne recto/verso/étiquettes par mot', () => {
    const csv = wordsToAnkiCsv([
      word({
        lemma: 'run',
        translations: ['courir', 'se précipiter'],
        definition: 'To move swiftly.',
        context: 'He ran to the "old" house.',
        bookTitle: 'The Empty House',
      }),
    ]);
    const lines = csv.trimEnd().split('\n');
    expect(lines.slice(0, 4)).toEqual([
      '#separator:comma',
      '#html:true',
      '#columns:Recto,Verso,Etiquettes',
      '#tags column:3',
    ]);
    expect(lines[4]).toBe(
      'run,"<b>courir, se précipiter</b><br>To move swiftly.<br><i>« He ran to the ""old"" house. »</i>",lecture en the_empty_house',
    );
  });

  it('échappe le HTML et retire les accents des étiquettes', () => {
    const csv = wordsToAnkiCsv([
      word({ word: 'a<b', language: 'fr', bookTitle: 'Le Jardin oublié', translations: [] }),
    ]);
    expect(csv).toContain('a&lt;b,,lecture fr le_jardin_oublie');
  });
});
