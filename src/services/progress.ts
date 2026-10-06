// Calculs d'avancement et de temps de lecture : fonctions pures, testées
// dans progress.test.ts.

/** Au-delà de ce seuil, un livre est considéré comme terminé. */
export const FINISHED_THRESHOLD = 0.99;

/** Sans interaction pendant ce délai, le lecteur est considéré comme absent. */
export const IDLE_LIMIT_MS = 5 * 60 * 1000;

/** Écart maximal compté entre deux mesures (protège contre la mise en veille). */
export const MAX_TICK_MS = 60 * 1000;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Avancement dans un PDF : la dernière page vaut 100 %. */
export function pdfPercentage(page: number, numPages: number): number {
  if (numPages <= 0) return 0;
  return clamp01(page / numPages);
}

export function isFinished(percentage: number): boolean {
  return percentage >= FINISHED_THRESHOLD;
}

export type DisplayLanguage = 'fr' | 'en';

/**
 * « 45 % » (français, espace avant %) ou « 45% » (anglais) ; arrondi vers
 * le bas pour n'afficher 100 % qu'à la toute fin.
 */
export function formatPercentage(percentage: number, language: DisplayLanguage = 'fr'): string {
  const value = Math.floor(clamp01(percentage) * 100);
  return language === 'fr' ? `${value} %` : `${value}%`;
}

/** « moins d'1 min », « 12 min », « 1 h 05 » (ou « less than 1 min », « 1 h 05 min »). */
export function formatDuration(ms: number, language: DisplayLanguage = 'fr'): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  if (totalMinutes < 1) return language === 'fr' ? 'moins d’1 min' : 'less than 1 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return language === 'fr' ? `${hours} h ${minutes}` : `${hours} h ${minutes} min`;
}

export interface ActiveTimeInput {
  /** Instant de la mesure précédente. */
  lastTick: number;
  now: number;
  /** Dernière interaction (page tournée, clic, touche…). */
  lastActivity: number;
  /** L'onglet est-il visible ? */
  visible: boolean;
  idleLimitMs?: number;
  maxTickMs?: number;
}

/**
 * Temps de lecture actif entre deux mesures : rien si l'onglet est caché,
 * et rien au-delà de `idleLimitMs` après la dernière interaction.
 */
export function activeTimeDelta({
  lastTick,
  now,
  lastActivity,
  visible,
  idleLimitMs = IDLE_LIMIT_MS,
  maxTickMs = MAX_TICK_MS,
}: ActiveTimeInput): number {
  if (!visible || now <= lastTick) return 0;
  const activeUntil = Math.min(now, lastActivity + idleLimitMs);
  const delta = activeUntil - lastTick;
  return delta > 0 ? Math.min(delta, maxTickMs) : 0;
}
