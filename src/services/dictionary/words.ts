import type { LookupLanguage } from './types';

const MAX_WORD_LENGTH = 40;

/** Élisions françaises en début de mot : l’arbre, qu’il, jusqu’à… */
const FRENCH_ELISION = /^(?:jusqu|lorsqu|puisqu|quoiqu|qu|[cdjlmnst])['’]/i;

/** Possessif anglais en fin de mot : John’s → John. */
const ENGLISH_POSSESSIVE = /['’]s$/i;

/** Ponctuation et symboles en bordure du mot. */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * Extrait un mot cherchable d'une sélection (« l’arbre, » → « arbre »).
 * Renvoie `null` si la sélection n'est pas un mot unique.
 */
export function extractWord(selection: string, language: LookupLanguage | 'unknown'): string | null {
  let word = selection.trim().replace(EDGE_PUNCTUATION, '');
  if (!word || /\s/.test(word) || word.length > MAX_WORD_LENGTH || !/\p{L}/u.test(word)) return null;
  if (language !== 'en') word = word.replace(FRENCH_ELISION, '');
  if (language !== 'fr') word = word.replace(ENGLISH_POSSESSIVE, '');
  word = word.replace(EDGE_PUNCTUATION, '');
  return word || null;
}

/** Variantes à essayer pour trouver une page : minuscules, casse d'origine, apostrophes. */
export function spellingVariants(word: string): string[] {
  const variants = [word.toLowerCase(), word];
  for (const variant of [...variants]) {
    if (variant.includes("'")) variants.push(variant.replaceAll("'", '’'));
    if (variant.includes('’')) variants.push(variant.replaceAll('’', "'"));
  }
  return [...new Set(variants)];
}

const VOWELS = /[aeiouy]/;

/**
 * Formes de base possibles d'un mot anglais fléchi, par règles simples
 * (utilisé seulement si le dictionnaire ne connaît pas le mot tel quel).
 */
export function englishLemmaCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const candidates: string[] = [];
  const add = (stem: string) => {
    if (stem.length >= 2 && stem !== w && VOWELS.test(stem)) candidates.push(stem);
  };
  // Consonne doublée : running → run, stopped → stop.
  const undouble = (stem: string) => (/([b-df-hj-np-tv-z])\1$/.test(stem) ? stem.slice(0, -1) : undefined);

  if (w.endsWith('ies')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ied')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    const single = undouble(stem);
    if (single) add(single);
    add(stem);
    add(`${stem}e`);
  }
  if (w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    const single = undouble(stem);
    if (single) add(single);
    add(stem);
    add(`${stem}e`);
  }
  return [...new Set(candidates)];
}

/** Formes de base possibles d'un mot français (pluriels réguliers). */
export function frenchLemmaCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const candidates: string[] = [];
  if (w.endsWith('aux')) candidates.push(`${w.slice(0, -3)}al`);
  if (w.endsWith('s') || w.endsWith('x')) candidates.push(w.slice(0, -1));
  if (w.endsWith('es')) candidates.push(w.slice(0, -2));
  return [...new Set(candidates)].filter((c) => c.length >= 2 && c !== w);
}
