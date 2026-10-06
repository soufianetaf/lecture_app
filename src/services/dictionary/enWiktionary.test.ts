import { describe, expect, it } from 'vitest';
import { HOUSE, MAISON, MANGE, RAN } from './__fixtures__/enWiktionary';
import { parseEnWiktionary } from './enWiktionary';

describe('parseEnWiktionary', () => {
  it('garde la seule langue demandée, sans définitions vides', () => {
    const entry = parseEnWiktionary(HOUSE, 'en')!;
    expect(entry.senses.map((s) => s.partOfSpeech)).toEqual(['Noun', 'Verb']);
    expect(entry.senses[0].definitions[0]).toEqual({
      text: 'A structure built or serving as an abode of human beings.',
      example: "This is my house and my family's ancestral home.",
      exampleTranslation: undefined,
    });
    expect(entry.onlyForms).toBe(false);
  });

  it('détecte une forme fléchie et sa forme de base', () => {
    const entry = parseEnWiktionary(RAN, 'en')!;
    expect(entry.onlyForms).toBe(true);
    expect(entry.lemma).toBe('run');
    expect(entry.senses[0].definitions[0].text).toBe('simple past of run');
  });

  it('lit les gloses anglaises d’un mot français, avec traduction d’exemple', () => {
    const entry = parseEnWiktionary(MAISON, 'fr')!;
    expect(entry.senses[0].definitions[0].text).toBe('house');
    expect(entry.senses[1].definitions[0]).toMatchObject({
      text: 'homemade',
      example: 'une grande tarte maison',
      exampleTranslation: 'a big home-made pie',
    });
  });

  it('trouve la forme de base d’un participe français', () => {
    expect(parseEnWiktionary(MANGE, 'fr')?.lemma).toBe('manger');
  });

  it('renvoie null quand la langue est absente', () => {
    expect(parseEnWiktionary(RAN, 'fr')).toBeNull();
  });
});
