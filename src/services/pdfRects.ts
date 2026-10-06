import type { NormalizedRect } from '../db/db';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Rectangles plus petits que ce seuil (en px) : artefacts de sélection, ignorés. */
const MIN_SIZE_PX = 1;

/** Deux rectangles sont sur la même ligne s'ils se chevauchent verticalement à ce point. */
const SAME_LINE_OVERLAP = 0.5;

/** Écart horizontal maximal (en proportion de la page) pour fusionner deux morceaux d'une ligne. */
const MAX_GAP = 0.01;

function verticalOverlap(a: NormalizedRect, b: NormalizedRect): number {
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlap / Math.min(a.height, b.height);
}

function union(a: NormalizedRect, b: NormalizedRect): NormalizedRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Fusionne les morceaux d'une même ligne (la couche de texte PDF découpe
 * souvent une ligne en plusieurs blocs) et trie dans l'ordre de lecture.
 */
export function mergeLineRects(rects: readonly NormalizedRect[]): NormalizedRect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: NormalizedRect[] = [];
  for (const rect of sorted) {
    const last = merged[merged.length - 1];
    const sameLine = last && verticalOverlap(last, rect) >= SAME_LINE_OVERLAP;
    const close = last && rect.x <= last.x + last.width + MAX_GAP;
    if (sameLine && close) merged[merged.length - 1] = union(last, rect);
    else merged.push(rect);
  }
  return merged;
}

/** Convertit les rectangles d'une sélection (en px écran) en proportions de la page. */
export function normalizeRects(clientRects: Box[], page: Box): NormalizedRect[] {
  if (page.width <= 0 || page.height <= 0) return [];
  const normalized: NormalizedRect[] = [];
  for (const rect of clientRects) {
    // On ne garde que la partie du rectangle qui est dans la page.
    const left = Math.max(rect.left, page.left);
    const top = Math.max(rect.top, page.top);
    const right = Math.min(rect.left + rect.width, page.left + page.width);
    const bottom = Math.min(rect.top + rect.height, page.top + page.height);
    if (right - left < MIN_SIZE_PX || bottom - top < MIN_SIZE_PX) continue;
    normalized.push({
      x: (left - page.left) / page.width,
      y: (top - page.top) / page.height,
      width: (right - left) / page.width,
      height: (bottom - top) / page.height,
    });
  }
  return mergeLineRects(normalized);
}

/** Le point (en proportions de la page) est-il dans l'un des rectangles ? */
export function rectsContainPoint(rects: readonly NormalizedRect[], x: number, y: number): boolean {
  return rects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
}
