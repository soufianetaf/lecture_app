export interface TextPart {
  text: string;
  match: boolean;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Découpe un texte pour mettre en valeur un mot (mot entier, sans tenir compte
 * de la casse) : « She ran to the gate. » + « ran » → She / ran / to the gate.
 */
export function splitOnWord(text: string, word: string): TextPart[] {
  if (!word.trim()) return [{ text, match: false }];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'giu');
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), match: false });
    parts.push({ text: match[0], match: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}

/** Longueur maximale d'un contexte enregistré, pour les phrases interminables. */
const MAX_CONTEXT_LENGTH = 300;

/** Fins de phrase : . ! ? … suivis d'une espace (ou fin du texte). */
const SENTENCE_END = /[.!?…]+["»”’)]*\s/g;

/**
 * Phrase du texte qui contient la sélection [start, end[ :
 * « …la mer. Une vieille maison entourée… » → « Une vieille maison entourée… ».
 */
export function sentenceAround(text: string, start: number, end: number): string {
  let sentenceStart = 0;
  let sentenceEnd = text.length;
  for (const match of text.matchAll(SENTENCE_END)) {
    const boundary = match.index + match[0].length;
    if (boundary <= start) sentenceStart = boundary;
    else if (match.index >= end - 1) {
      sentenceEnd = match.index + match[0].trimEnd().length;
      break;
    }
  }

  let sentence = text.slice(sentenceStart, sentenceEnd).replace(/\s+/g, ' ').trim();
  if (sentence.length > MAX_CONTEXT_LENGTH) {
    // Phrase trop longue : on garde une fenêtre centrée sur le mot.
    const center = start - sentenceStart;
    const from = Math.max(0, center - MAX_CONTEXT_LENGTH / 2);
    sentence = `${from > 0 ? '…' : ''}${sentence.slice(from, from + MAX_CONTEXT_LENGTH).trim()}…`;
  }
  return sentence;
}
