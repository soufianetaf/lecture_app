import { describe, expect, it } from 'vitest';
import { parseRoute, ROUTES } from './routes';

describe('parseRoute', () => {
  it.each([
    ['', { name: 'library' }],
    ['#/', { name: 'library' }],
    ['#/inconnu', { name: 'library' }],
    ['#/livre/abc-123', { name: 'reader', bookId: 'abc-123' }],
    ['#/vocabulaire', { name: 'vocabulary' }],
    ['#/revision', { name: 'review' }],
    ['#/parametres', { name: 'settings' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it('relit les adresses qu’il produit', () => {
    expect(parseRoute(ROUTES.reader('id-1'))).toEqual({ name: 'reader', bookId: 'id-1' });
    expect(parseRoute(ROUTES.vocabulary)).toEqual({ name: 'vocabulary' });
  });
});
