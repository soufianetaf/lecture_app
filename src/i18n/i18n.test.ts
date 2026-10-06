import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { detectUiLanguage } from './index';

/** Toutes les feuilles (textes et fonctions) d'un dictionnaire, avec leur chemin. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

describe('dictionnaires', () => {
  it('ont exactement les mêmes clés en français et en anglais', () => {
    expect(leaves(en).map(([path]) => path)).toEqual(leaves(fr).map(([path]) => path));
  });

  it('n’ont aucun texte vide', () => {
    for (const [path, value] of [...leaves(fr), ...leaves(en)]) {
      if (typeof value === 'string') expect(value.trim(), path).not.toBe('');
    }
  });

  it('accordent le pluriel', () => {
    expect(fr.review.remaining(1)).toBe('1 carte restante');
    expect(fr.review.remaining(3)).toBe('3 cartes restantes');
    expect(en.review.remaining(1)).toBe('1 card left');
    expect(en.highlights.markdown.count(0)).toBe('0 highlights');
    expect(fr.highlights.markdown.count(0)).toBe('0 surlignage'); // en français, 0 est singulier
  });

  it('formatent selon la langue', () => {
    expect(fr.format.percentage(0.5)).toBe('50 %');
    expect(en.format.percentage(0.5)).toBe('50%');
    expect(en.format.interval(1)).toBe('tomorrow');
  });
});

describe('detectUiLanguage', () => {
  it.each([
    [['fr-FR', 'en-US'], 'fr'],
    [['en-GB'], 'en'],
    [['de-DE', 'en-US'], 'en'],
    [['de-DE'], 'fr'],
    [[], 'fr'],
  ] as const)('%j → %s', (languages, expected) => {
    expect(detectUiLanguage(languages)).toBe(expected);
  });
});
