const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Décode les entités HTML (&amp;, &#39;, &#x2019;…). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Texte brut d'un fragment HTML de Wiktionary (sans DOM, utilisable en test) :
 * styles et balises retirés, entités décodées, espaces normalisés.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}
