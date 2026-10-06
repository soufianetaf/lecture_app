import { describe, expect, it } from 'vitest';
import { formatInterval, initialReview, KNOWN_INTERVAL_DAYS, reviewForStatus, schedule, statusFor } from './srs';

const NOW = Date.UTC(2026, 9, 6);
const DAY = 24 * 60 * 60 * 1000;

describe('schedule', () => {
  it('espace les révisions : 1 jour, 3 jours, puis × facilité', () => {
    let review = schedule(initialReview(NOW), 'good', NOW);
    expect(review.intervalDays).toBe(1);
    expect(review.dueAt).toBe(NOW + DAY);
    expect(review.status).toBe('learning');

    review = schedule(review, 'good', review.dueAt);
    expect(review.intervalDays).toBe(3);

    review = schedule(review, 'good', review.dueAt);
    expect(review.intervalDays).toBe(Math.round(3 * 2.5));
  });

  it('fait revenir un mot oublié dans la séance et baisse sa facilité', () => {
    const learned = schedule(schedule(initialReview(NOW), 'good', NOW), 'good', NOW + DAY);
    const forgotten = schedule(learned, 'again', NOW + 4 * DAY);
    expect(forgotten.dueAt).toBe(NOW + 4 * DAY + 10 * 60 * 1000);
    expect(forgotten.repetitions).toBe(0);
    expect(forgotten.lapses).toBe(1);
    expect(forgotten.ease).toBeCloseTo(2.3);
  });

  it('ne descend jamais sous la facilité minimale', () => {
    let review = initialReview(NOW);
    for (let i = 0; i < 20; i++) review = schedule(review, 'again', NOW);
    expect(review.ease).toBe(1.3);
  });

  it('« facile » espace davantage que « bien »', () => {
    const good = schedule(initialReview(NOW), 'good', NOW);
    const easy = schedule(initialReview(NOW), 'easy', NOW);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
    expect(easy.ease).toBeGreaterThan(good.ease);
  });

  it('« difficile » rapproche la prochaine révision', () => {
    let review = initialReview(NOW);
    for (let i = 0; i < 3; i++) review = schedule(review, 'good', NOW);
    const hard = schedule(review, 'hard', NOW);
    const good = schedule(review, 'good', NOW);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
  });

  it('marque le mot acquis à partir de 21 jours d’intervalle', () => {
    let review = initialReview(NOW);
    while (review.intervalDays < KNOWN_INTERVAL_DAYS) review = schedule(review, 'good', NOW);
    expect(statusFor(review)).toBe('known');
  });

  it('plafonne l’intervalle à un an', () => {
    let review = initialReview(NOW);
    for (let i = 0; i < 30; i++) review = schedule(review, 'easy', NOW);
    expect(review.intervalDays).toBe(365);
  });
});

describe('statusFor', () => {
  it('distingue nouveau, en cours et acquis', () => {
    expect(statusFor(initialReview(NOW))).toBe('new');
    expect(statusFor({ intervalDays: 3, repetitions: 2, lastReviewedAt: NOW })).toBe('learning');
    expect(statusFor({ intervalDays: 30, repetitions: 5, lastReviewedAt: NOW })).toBe('known');
  });
});

describe('reviewForStatus', () => {
  it('« acquis » repousse la révision de 21 jours', () => {
    const review = reviewForStatus('known', initialReview(NOW), NOW);
    expect(statusFor(review)).toBe('known');
    expect(review.dueAt).toBe(NOW + 21 * DAY);
  });

  it('« nouveau » remet le mot à zéro', () => {
    const learned = schedule(initialReview(NOW), 'easy', NOW);
    expect(reviewForStatus('new', learned, NOW)).toEqual(initialReview(NOW));
  });

  it('« en cours » le rend révisable tout de suite', () => {
    const review = reviewForStatus('learning', initialReview(NOW), NOW);
    expect(statusFor(review)).toBe('learning');
    expect(review.dueAt).toBe(NOW);
  });
});

describe('formatInterval', () => {
  it.each([
    [0, 'dans 10 min'],
    [1, 'demain'],
    [8, 'dans 8 jours'],
    [60, 'dans 2 mois'],
    [365, 'dans 1 an'],
  ])('%i jours → %s', (days, label) => {
    expect(formatInterval(days)).toBe(label);
  });
});
