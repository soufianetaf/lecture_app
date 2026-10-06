import { describe, expect, it } from 'vitest';
import { safeFileName } from './download';

describe('safeFileName', () => {
  it('retire les accents et la ponctuation', () => {
    expect(safeFileName('Le Jardin oublié : tome 1 !')).toBe('le-jardin-oublie-tome-1');
  });

  it('a une valeur de repli pour un titre vide', () => {
    expect(safeFileName('???')).toBe('livre');
  });
});
