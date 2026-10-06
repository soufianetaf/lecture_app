import { describe, expect, it } from 'vitest';
import { advanceQueue } from './session';

describe('advanceQueue', () => {
  it('retire la carte répondue', () => {
    expect(advanceQueue(['a', 'b', 'c'], 'a', 'good')).toEqual(['b', 'c']);
  });

  it('remet un mot oublié en fin de séance (version à jour)', () => {
    expect(advanceQueue(['a', 'b'], 'a*', 'again')).toEqual(['b', 'a*']);
  });

  it('termine la séance après la dernière carte', () => {
    expect(advanceQueue(['a'], 'a', 'easy')).toEqual([]);
  });
});
