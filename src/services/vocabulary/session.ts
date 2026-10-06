import type { Grade } from './srs';

/** Nombre de mots par séance : assez pour progresser, assez peu pour ne pas lasser. */
export const SESSION_SIZE = 20;

/**
 * File de la séance après une réponse : la carte en tête est retirée ;
 * un mot oublié (« à revoir ») revient en fin de séance.
 */
export function advanceQueue<T>(queue: readonly T[], answered: T, grade: Grade): T[] {
  const rest = queue.slice(1);
  return grade === 'again' ? [...rest, answered] : rest;
}
