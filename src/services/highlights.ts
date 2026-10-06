import type { Highlight, HighlightAnchor, HighlightColor } from '../db/db';

/** Couleurs proposées (leurs noms sont traduits par l'interface). */
export const HIGHLIGHT_COLORS: { value: HighlightColor; fill: string }[] = [
  { value: 'yellow', fill: '#facc15' },
  { value: 'green', fill: '#4ade80' },
  { value: 'pink', fill: '#f472b6' },
  { value: 'blue', fill: '#60a5fa' },
];

export function colorFill(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.value === color)?.fill ?? HIGHLIGHT_COLORS[0].fill;
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

/** Libellés de l'export, dans la langue de l'interface. */
export interface MarkdownLabels {
  author: string;
  count(n: number): string;
  note: string;
  color(color: HighlightColor): string;
}

/** Export Markdown, groupé par chapitre / page, dans l'ordre donné. */
export function highlightsToMarkdown(book: { title: string }, highlights: Highlight[], labels: MarkdownLabels): string {
  const lines = [`# ${book.title}`, '', `*${labels.author}* — ${labels.count(highlights.length)}`, ''];
  let currentLabel: string | undefined;
  for (const highlight of highlights) {
    if (highlight.label && highlight.label !== currentLabel) {
      currentLabel = highlight.label;
      lines.push(`## ${currentLabel}`, '');
    }
    lines.push(`> ${highlight.text}`);
    if (highlight.note) lines.push('', `**${labels.note}** ${highlight.note}`);
    lines.push('', `*${labels.color(highlight.color)}*`, '');
  }
  return lines.join('\n');
}
