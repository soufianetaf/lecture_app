import { describe, expect, it } from 'vitest';
import { sentenceAround, splitOnWord } from './sentence';

describe('splitOnWord', () => {
  it('isole le mot entier, sans tenir compte de la casse', () => {
    expect(splitOnWord('Ran, she ran to the ranch.', 'ran')).toEqual([
      { text: 'Ran', match: true },
      { text: ', she ', match: false },
      { text: 'ran', match: true },
      { text: ' to the ranch.', match: false },
    ]);
  });

  it('gère les accents et les caractères spéciaux', () => {
    expect(splitOnWord('L’été (été) passe.', 'été').filter((p) => p.match)).toHaveLength(2);
    expect(splitOnWord('a+b vaut c', 'a+b')[0]).toEqual({ text: 'a+b', match: true });
  });

  it('renvoie le texte entier sans correspondance', () => {
    expect(splitOnWord('Rien ici.', 'mot')).toEqual([{ text: 'Rien ici.', match: false }]);
  });
});

const at = (text: string, word: string) => {
  const start = text.indexOf(word);
  return sentenceAround(text, start, start + word.length);
};

describe('sentenceAround', () => {
  const text =
    'Il était une fois une ville au bord de la mer. Une vieille maison y était entourée d’un jardin ! Personne ne la visitait plus.';

  it('renvoie la phrase qui contient le mot', () => {
    expect(at(text, 'maison')).toBe('Une vieille maison y était entourée d’un jardin !');
  });

  it('gère la première et la dernière phrase', () => {
    expect(at(text, 'ville')).toBe('Il était une fois une ville au bord de la mer.');
    expect(at(text, 'visitait')).toBe('Personne ne la visitait plus.');
  });

  it('ne coupe pas aux guillemets fermants', () => {
    expect(at('« Viens ! » dit-elle. Il partit.', 'Il')).toBe('Il partit.');
  });

  it('normalise les espaces et retours à la ligne', () => {
    expect(at('Une vieille\n  maison isolée.', 'maison')).toBe('Une vieille maison isolée.');
  });

  it('réduit une phrase trop longue autour du mot', () => {
    const long = `${'mot '.repeat(100)}cible ${'mot '.repeat(100)}.`;
    const result = at(long, 'cible');
    expect(result.length).toBeLessThanOrEqual(302);
    expect(result).toContain('cible');
    expect(result.startsWith('…')).toBe(true);
  });
});
