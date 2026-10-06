import { describe, expect, it } from 'vitest';
import { LookupError } from './errors';
import { parseMyMemory } from './myMemory';

describe('parseMyMemory', () => {
  it('renvoie le texte traduit décodé', () => {
    expect(
      parseMyMemory({ responseData: { translatedText: 'l&#39;arbre' }, responseStatus: 200, quotaFinished: false }),
    ).toBe("l'arbre");
  });

  it('signale la fin du quota', () => {
    const quota = () =>
      parseMyMemory({
        responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.' },
        responseStatus: 429,
      });
    expect(quota).toThrow(LookupError);
    expect(quota).toThrow(expect.objectContaining({ kind: 'quota' }));
  });

  it('signale une erreur du service', () => {
    expect(() => parseMyMemory({ responseStatus: '403' })).toThrow(expect.objectContaining({ kind: 'service' }));
  });
});
