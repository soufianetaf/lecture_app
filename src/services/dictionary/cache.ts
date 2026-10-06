import { db } from '../../db/db';

const DAY_MS = 24 * 60 * 60 * 1000;

/** À incrémenter quand le format des résultats change : l'ancien cache est ignoré. */
const CACHE_VERSION = 'v4';

export const CACHE_TTL = {
  /** Les définitions changent rarement. */
  found: 30 * DAY_MS,
  /** Un mot introuvable peut être ajouté au dictionnaire : on réessaie plus tôt. */
  notFound: 7 * DAY_MS,
};

/**
 * Renvoie le résultat en cache s'il est encore valide, sinon le calcule et le
 * met en cache (y compris « introuvable »). Les erreurs ne sont jamais mises
 * en cache, et une base indisponible n'empêche pas la recherche.
 */
export async function cached<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  const fullKey = `${CACHE_VERSION}:${key}`;
  try {
    const hit = await db.dictCache.get(fullKey);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T | null;
  } catch (error) {
    console.warn('Cache du dictionnaire illisible', error);
  }

  const value = await load();
  const ttl = value === null ? CACHE_TTL.notFound : CACHE_TTL.found;
  await db.dictCache
    .put({ key: fullKey, value, expiresAt: Date.now() + ttl })
    .catch((error) => console.warn('Cache du dictionnaire non enregistré', error));
  return value;
}
