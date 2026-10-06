import { franc } from 'franc-min';
import type { BookLanguage } from '../db/db';

/** Normalise un code de langue de métadonnées ("en-US", "fre", "French"…). */
export function normalizeLanguage(code: string | undefined | null): BookLanguage {
  if (!code) return 'unknown';
  const c = code.trim().toLowerCase();
  if (c.startsWith('fr') || c === 'fre' || c === 'fra') return 'fr';
  if (c.startsWith('en') || c === 'eng') return 'en';
  return 'unknown';
}

/** Devine la langue d'un extrait de texte (français ou anglais uniquement). */
export function detectLanguage(text: string): BookLanguage {
  const sample = text.replace(/\s+/g, ' ').slice(0, 5000);
  const result = franc(sample, { only: ['fra', 'eng'], minLength: 50 });
  if (result === 'fra') return 'fr';
  if (result === 'eng') return 'en';
  return 'unknown';
}
