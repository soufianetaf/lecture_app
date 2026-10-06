import { describe, expect, it } from 'vitest';
import { englishLemmaCandidates, extractWord, frenchLemmaCandidates, spellingVariants } from './words';

describe('extractWord', () => {
  it.each([
    ['maison,', 'fr', 'maison'],
    ['« Bonjour »', 'fr', 'Bonjour'],
    ['l’arbre', 'fr', 'arbre'],
    ["qu'il", 'fr', 'il'],
    ['jusqu’au', 'fr', 'au'],
    ["John's", 'en', 'John'],
    ['(running)', 'en', 'running'],
    ["don't", 'en', "don't"],
    ['aujourd’hui', 'fr', 'aujourd’hui'],
  ] as const)('%s (%s) → %s', (input, language, expected) => {
    expect(extractWord(input, language)).toBe(expected);
  });

  it('refuse une sélection de plusieurs mots', () => {
    expect(extractWord('il était une fois', 'fr')).toBeNull();
  });

  it('refuse une sélection sans lettre', () => {
    expect(extractWord('1914 —', 'fr')).toBeNull();
  });
});

describe('spellingVariants', () => {
  it('essaie les minuscules puis la casse d’origine', () => {
    expect(spellingVariants('Paris')).toEqual(['paris', 'Paris']);
  });

  it('essaie les deux apostrophes', () => {
    expect(spellingVariants("aujourd'hui")).toEqual(["aujourd'hui", 'aujourd’hui']);
  });
});

describe('englishLemmaCandidates', () => {
  it.each([
    ['running', 'run'],
    ['stopped', 'stop'],
    ['baked', 'bake'],
    ['played', 'play'],
    ['cities', 'city'],
    ['carried', 'carry'],
    ['boxes', 'box'],
    ['books', 'book'],
    ['making', 'make'],
  ])('%s → contient %s', (word, lemma) => {
    expect(englishLemmaCandidates(word)).toContain(lemma);
  });

  it('ne propose rien pour un mot de base', () => {
    expect(englishLemmaCandidates('glass')).toEqual([]);
  });
});

describe('frenchLemmaCandidates', () => {
  it('retire les marques de pluriel régulières', () => {
    expect(frenchLemmaCandidates('chevaux')).toContain('cheval');
    expect(frenchLemmaCandidates('maisons')).toContain('maison');
    expect(frenchLemmaCandidates('jeux')).toContain('jeu');
  });
});
