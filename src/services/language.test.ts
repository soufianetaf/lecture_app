import { describe, expect, it } from 'vitest';
import { detectLanguage, normalizeLanguage } from './language';

describe('normalizeLanguage', () => {
  it.each([
    ['fr', 'fr'],
    ['fr-CA', 'fr'],
    ['fre', 'fr'],
    ['en-US', 'en'],
    ['eng', 'en'],
    ['de', 'unknown'],
    ['', 'unknown'],
    [undefined, 'unknown'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });
});

describe('detectLanguage', () => {
  it('reconnaît le français', () => {
    expect(
      detectLanguage(
        "Il était une fois, dans une petite ville au bord de la mer, une vieille maison entourée d'un jardin que personne ne visitait plus.",
      ),
    ).toBe('fr');
  });

  it("reconnaît l'anglais", () => {
    expect(
      detectLanguage(
        'It was a bright cold day in April, and the clocks were striking thirteen. The old house had been empty for years.',
      ),
    ).toBe('en');
  });

  it('renvoie unknown pour un texte trop court', () => {
    expect(detectLanguage('Bonjour')).toBe('unknown');
  });
});
