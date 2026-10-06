import type { Highlight, HighlightAnchor, HighlightColor } from '../db/db';

export const HIGHLIGHT_COLORS: { value: HighlightColor; label: string; fill: string }[] = [
  { value: 'yellow', label: 'Jaune', fill: '#facc15' },
  { value: 'green', label: 'Vert', fill: '#4ade80' },
  { value: 'pink', label: 'Rose', fill: '#f472b6' },
  { value: 'blue', label: 'Bleu', fill: '#60a5fa' },
];

export function colorFill(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.value === color)?.fill ?? HIGHLIGHT_COLORS[0].fill;
}

export function colorLabel(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.value === color)?.label ?? color;
}

/** Compare deux positions EPUB (CFI) ; injecté pour garder ce module sans epub.js. */
export type CfiComparator = (a: string, b: string) => number;

/** Ordre de lecture : page puis position sur la page (PDF), ou CFI (EPUB). */
export function compareAnchors(a: HighlightAnchor, b: HighlightAnchor, compareCfi: CfiComparator): number {
  if (a.format === 'pdf' && b.format === 'pdf') {
    const [ra, rb] = [a.rects[0], b.rects[0]];
    return a.page - b.page || (ra?.y ?? 0) - (rb?.y ?? 0) || (ra?.x ?? 0) - (rb?.x ?? 0);
  }
  if (a.format === 'epub' && b.format === 'epub') return compareCfi(a.cfiRange, b.cfiRange);
  return 0;
}

export function sortHighlights(highlights: Highlight[], compareCfi: CfiComparator): Highlight[] {
  return [...highlights].sort((a, b) => compareAnchors(a.anchor, b.anchor, compareCfi) || a.createdAt - b.createdAt);
}

/** Texte de sélection nettoyé : espaces multiples et retours à la ligne réduits. */
export function cleanSelectionText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Export Markdown, groupé par chapitre / page, dans l'ordre donné. */
export function highlightsToMarkdown(book: { title: string; author: string }, highlights: Highlight[]): string {
  const lines = [`# ${book.title}`, '', `*${book.author}* — ${highlights.length} surlignage(s)`, ''];
  let currentLabel: string | undefined;
  for (const highlight of highlights) {
    if (highlight.label && highlight.label !== currentLabel) {
      currentLabel = highlight.label;
      lines.push(`## ${currentLabel}`, '');
    }
    lines.push(`> ${highlight.text}`);
    if (highlight.note) lines.push('', `**Note :** ${highlight.note}`);
    lines.push('', `*${colorLabel(highlight.color)}*`, '');
  }
  return lines.join('\n');
}
