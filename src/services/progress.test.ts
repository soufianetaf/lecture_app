import { describe, expect, it } from 'vitest';
import {
  activeTimeDelta,
  clamp01,
  formatDuration,
  formatPercentage,
  isFinished,
  MAX_TICK_MS,
  pdfPercentage,
} from './progress';

describe('clamp01', () => {
  it('borne la valeur entre 0 et 1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(3)).toBe(1);
  });

  it('renvoie 0 pour une valeur non numérique', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('pdfPercentage', () => {
  it('vaut 100 % sur la dernière page', () => {
    expect(pdfPercentage(120, 120)).toBe(1);
  });

  it('est proportionnel à la page', () => {
    expect(pdfPercentage(30, 120)).toBe(0.25);
  });

  it('ne divise pas par zéro', () => {
    expect(pdfPercentage(1, 0)).toBe(0);
  });
});

describe('formatPercentage', () => {
  it("arrondit vers le bas pour n'afficher 100 % qu'à la fin", () => {
    expect(formatPercentage(0.999)).toBe('99 %');
    expect(formatPercentage(1)).toBe('100 %');
    expect(formatPercentage(0.456)).toBe('45 %');
  });

  it('suit la typographie anglaise en anglais', () => {
    expect(formatPercentage(0.456, 'en')).toBe('45%');
  });
});

describe('isFinished', () => {
  it('considère un livre terminé à partir de 99 %', () => {
    expect(isFinished(0.98)).toBe(false);
    expect(isFinished(0.99)).toBe(true);
  });
});

describe('formatDuration', () => {
  it('affiche les minutes et les heures', () => {
    expect(formatDuration(30_000)).toBe('moins d’1 min');
    expect(formatDuration(12 * 60_000)).toBe('12 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05');
  });

  it('existe en anglais', () => {
    expect(formatDuration(30_000, 'en')).toBe('less than 1 min');
    expect(formatDuration(65 * 60_000, 'en')).toBe('1 h 05 min');
  });
});

describe('activeTimeDelta', () => {
  const base = { lastTick: 1_000_000, idleLimitMs: 5 * 60_000 };

  it("compte le temps écoulé quand l'onglet est visible et le lecteur actif", () => {
    expect(activeTimeDelta({ ...base, now: base.lastTick + 15_000, lastActivity: base.lastTick, visible: true })).toBe(
      15_000,
    );
  });

  it("ne compte rien quand l'onglet est caché", () => {
    expect(activeTimeDelta({ ...base, now: base.lastTick + 15_000, lastActivity: base.lastTick, visible: false })).toBe(
      0,
    );
  });

  it("s'arrête à la limite d'inactivité", () => {
    const lastActivity = base.lastTick - 4 * 60_000; // inactif depuis 4 min
    const now = base.lastTick + 15_000;
    // Seule la minute restante avant la limite de 5 min compte.
    expect(activeTimeDelta({ ...base, now, lastActivity, visible: true })).toBe(15_000);
    expect(activeTimeDelta({ ...base, now: base.lastTick + 90_000, lastActivity, visible: true })).toBe(60_000);
  });

  it("ne compte rien quand l'inactivité dépassait déjà la limite", () => {
    const lastActivity = base.lastTick - 10 * 60_000;
    expect(activeTimeDelta({ ...base, now: base.lastTick + 15_000, lastActivity, visible: true })).toBe(0);
  });

  it('plafonne un écart anormal (mise en veille)', () => {
    const now = base.lastTick + 3 * 60_000;
    expect(activeTimeDelta({ ...base, now, lastActivity: now, visible: true })).toBe(MAX_TICK_MS);
  });
});
