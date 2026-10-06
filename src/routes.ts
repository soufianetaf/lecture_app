// Navigation par l'adresse (#/…) : chaque écran a une URL, qui survit au rechargement.

export type Route =
  | { name: 'library' }
  | { name: 'reader'; bookId: string }
  | { name: 'vocabulary' }
  | { name: 'review' }
  | { name: 'settings' };

export const ROUTES = {
  library: '#/',
  vocabulary: '#/vocabulaire',
  review: '#/revision',
  settings: '#/parametres',
  reader: (bookId: string) => `#/livre/${bookId}`,
};

export function parseRoute(hash: string): Route {
  const reader = hash.match(/^#\/livre\/([\w-]+)$/);
  if (reader) return { name: 'reader', bookId: reader[1] };
  if (hash === ROUTES.vocabulary) return { name: 'vocabulary' };
  if (hash === ROUTES.review) return { name: 'review' };
  if (hash === ROUTES.settings) return { name: 'settings' };
  return { name: 'library' };
}
