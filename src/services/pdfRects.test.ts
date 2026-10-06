import { describe, expect, it } from 'vitest';
import { mergeLineRects, normalizeRects, rectsContainPoint } from './pdfRects';

const page = { left: 100, top: 50, width: 600, height: 800 };

describe('normalizeRects', () => {
  it('convertit en proportions de la page', () => {
    const [rect] = normalizeRects([{ left: 160, top: 130, width: 300, height: 16 }], page);
    expect(rect.x).toBeCloseTo(0.1);
    expect(rect.y).toBeCloseTo(0.1);
    expect(rect.width).toBeCloseTo(0.5);
    expect(rect.height).toBeCloseTo(0.02);
  });

  it('ignore les rectangles vides', () => {
    expect(normalizeRects([{ left: 200, top: 200, width: 0, height: 16 }], page)).toEqual([]);
  });

  it('coupe ce qui dépasse de la page', () => {
    const [rect] = normalizeRects([{ left: 50, top: 100, width: 100, height: 20 }], page);
    expect(rect.x).toBe(0);
    expect(rect.width * page.width).toBeCloseTo(50);
  });

  it('renvoie une liste vide pour une page sans taille', () => {
    expect(normalizeRects([{ left: 0, top: 0, width: 10, height: 10 }], { ...page, width: 0 })).toEqual([]);
  });
});

describe('mergeLineRects', () => {
  it('fusionne les morceaux contigus d’une même ligne', () => {
    const merged = mergeLineRects([
      { x: 0.3, y: 0.1, width: 0.2, height: 0.02 },
      { x: 0.1, y: 0.1, width: 0.2, height: 0.02 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBeCloseTo(0.1);
    expect(merged[0].width).toBeCloseTo(0.4);
  });

  it('garde des lignes différentes séparées, dans l’ordre de lecture', () => {
    const merged = mergeLineRects([
      { x: 0.1, y: 0.2, width: 0.5, height: 0.02 },
      { x: 0.1, y: 0.1, width: 0.5, height: 0.02 },
    ]);
    expect(merged.map((r) => r.y)).toEqual([0.1, 0.2]);
  });

  it('ne fusionne pas deux blocs éloignés sur la même ligne (colonnes)', () => {
    const merged = mergeLineRects([
      { x: 0.05, y: 0.1, width: 0.3, height: 0.02 },
      { x: 0.6, y: 0.1, width: 0.3, height: 0.02 },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('rectsContainPoint', () => {
  const rects = [{ x: 0.1, y: 0.1, width: 0.5, height: 0.02 }];

  it('détecte un point dans un rectangle', () => {
    expect(rectsContainPoint(rects, 0.3, 0.11)).toBe(true);
  });

  it('rejette un point en dehors', () => {
    expect(rectsContainPoint(rects, 0.3, 0.5)).toBe(false);
  });
});
