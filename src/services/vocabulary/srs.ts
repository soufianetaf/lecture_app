// Répétition espacée, version simplifiée de SM-2 (l'algorithme d'Anki) :
// un mot bien connu revient de moins en moins souvent, un mot oublié revient vite.

import type { ReviewState, WordStatus } from '../../db/db';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const INITIAL_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 365;
/** Un oubli fait revenir le mot dans la même séance, après ce délai. */
const RELEARN_DELAY_MS = 10 * MINUTE_MS;
/** À partir de cet intervalle, le mot est considéré comme acquis. */
export const KNOWN_INTERVAL_DAYS = 21;

/** État d'un mot jamais révisé : à revoir tout de suite. */
export function initialReview(now: number): ReviewState {
  return { dueAt: now, intervalDays: 0, ease: INITIAL_EASE, repetitions: 0, lapses: 0 };
}

export function statusFor(review: Pick<ReviewState, 'intervalDays' | 'repetitions' | 'lastReviewedAt'>): WordStatus {
  if (review.intervalDays >= KNOWN_INTERVAL_DAYS) return 'known';
  return review.lastReviewedAt === undefined ? 'new' : 'learning';
}

/** Nouvel état après une réponse. */
export function schedule(review: ReviewState, grade: Grade, now: number): ReviewState & { status: WordStatus } {
  let { ease, intervalDays, repetitions, lapses } = review;

  if (grade === 'again') {
    lapses += 1;
    repetitions = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    intervalDays = 0;
    const next = { dueAt: now + RELEARN_DELAY_MS, intervalDays, ease, repetitions, lapses, lastReviewedAt: now };
    return { ...next, status: statusFor(next) };
  }

  if (grade === 'hard') {
    ease = Math.max(MIN_EASE, ease - 0.15);
    intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
  } else if (grade === 'good') {
    intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.round(intervalDays * ease);
  } else {
    intervalDays = repetitions === 0 ? 4 : Math.round(intervalDays * ease * 1.3);
    ease += 0.15;
  }
  repetitions += 1;
  intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(1, intervalDays));

  const next = { dueAt: now + intervalDays * DAY_MS, intervalDays, ease, repetitions, lapses, lastReviewedAt: now };
  return { ...next, status: statusFor(next) };
}

/** État correspondant à un statut choisi à la main dans la liste. */
export function reviewForStatus(status: WordStatus, current: ReviewState, now: number): ReviewState {
  if (status === 'new') return initialReview(now);
  if (status === 'known') {
    return {
      ...current,
      intervalDays: KNOWN_INTERVAL_DAYS,
      dueAt: now + KNOWN_INTERVAL_DAYS * DAY_MS,
      lastReviewedAt: now,
    };
  }
  return { ...current, intervalDays: 1, dueAt: now, lastReviewedAt: current.lastReviewedAt ?? now };
}

/** « dans 3 jours », « dans 2 mois »… pour annoncer le prochain passage. */
export function formatInterval(days: number): string {
  if (days < 1) return 'dans 10 min';
  if (days === 1) return 'demain';
  if (days < 30) return `dans ${days} jours`;
  const months = Math.round(days / 30);
  return months < 12 ? `dans ${months} mois` : 'dans 1 an';
}
