import { useCallback, useEffect, useRef } from 'react';
import { activeTimeDelta } from '../services/progress';
import { addReadingTime } from '../services/progressService';

const TICK_MS = 15 * 1000;
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;

/**
 * Compte le temps de lecture actif d'un livre (onglet visible, lecteur pas
 * inactif) et l'enregistre régulièrement. Renvoie `markActivity`, à appeler
 * quand le lecteur interagit hors de la page (ex. dans l'iframe EPUB).
 */
export function useReadingTimer(bookId: string, enabled: boolean): () => void {
  const lastActivity = useRef(0);

  const markActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let lastTick = Date.now();
    let sessionId: number | undefined;
    // Les écritures sont chaînées pour ne jamais créer deux sessions.
    let pending = Promise.resolve();
    lastActivity.current = lastTick;

    const flush = (visible: boolean) => {
      const now = Date.now();
      const delta = activeTimeDelta({ lastTick, now, lastActivity: lastActivity.current, visible });
      lastTick = now;
      if (delta <= 0) return;
      pending = pending
        .then(() => addReadingTime(bookId, sessionId, delta, now))
        .then((id) => {
          sessionId = id;
        })
        .catch((error) => console.error('Temps de lecture non enregistré', error));
    };

    const onVisibilityChange = () => {
      // En passant en arrière-plan : on compte jusqu'à maintenant.
      // Au retour : on repart de maintenant, sans compter l'absence.
      if (document.visibilityState === 'hidden') flush(true);
      else lastTick = Date.now();
    };
    const onPageHide = () => flush(document.visibilityState === 'visible');

    const interval = setInterval(() => flush(document.visibilityState === 'visible'), TICK_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, markActivity, { passive: true });

    return () => {
      flush(document.visibilityState === 'visible');
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActivity);
    };
  }, [bookId, enabled, markActivity]);

  return markActivity;
}
