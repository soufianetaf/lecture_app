import { useEffect, useEffectEvent, useState } from 'react';

export type AsyncState<T> =
  { status: 'idle' } | { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: unknown };

type Settled<T> = { key: string } & ({ status: 'success'; data: T } | { status: 'error'; error: unknown });

/**
 * Exécute `task` à chaque nouvelle `key` et expose son état. Le résultat
 * d'une ancienne clé (réponse arrivée trop tard) est ignoré. `key: null`
 * = rien à charger.
 */
export function useAsync<T>(task: () => Promise<T>, key: string | null): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T>>();
  const run = useEffectEvent(task);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    run().then(
      (data) => {
        if (!cancelled) setSettled({ key, status: 'success', data });
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ key, status: 'error', error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (key === null) return { status: 'idle' };
  // État dérivé : tant que le résultat de la clé courante n'est pas arrivé, on charge.
  if (settled?.key !== key) return { status: 'loading' };
  return settled.status === 'success'
    ? { status: 'success', data: settled.data }
    : { status: 'error', error: settled.error };
}
