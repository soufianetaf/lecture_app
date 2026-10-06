import { LookupError } from './errors';

const TIMEOUT_MS = 8000;

/** Lu à chaque appel : la connexion peut tomber pendant une requête. */
const isOffline = () => globalThis.navigator?.onLine === false;

/**
 * GET JSON avec délai maximal. Renvoie `null` pour une page introuvable (404),
 * lève une `LookupError` typée pour tout autre échec.
 */
export async function fetchJson<T>(url: string): Promise<T | null> {
  if (isOffline()) throw new LookupError('offline');

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new LookupError('timeout', { cause: error });
    throw new LookupError(isOffline() ? 'offline' : 'network', { cause: error });
  }

  if (response.status === 404) return null;
  if (response.status === 429) throw new LookupError('quota');
  if (!response.ok) throw new LookupError('service');
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new LookupError('service', { cause: error });
  }
}
