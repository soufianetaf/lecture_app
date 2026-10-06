import { sentenceAround } from '../services/vocabulary/sentence';

/**
 * Phrase qui contient une sélection, reconstituée à partir des nœuds texte
 * de `root`. `separator` relie les nœuds : '' pour un paragraphe EPUB,
 * ' ' pour la couche de texte PDF (un nœud par morceau de ligne).
 */
export function selectionSentence(range: Range, root: Node, separator: string): string | undefined {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const selected = range.toString();
  let text = '';
  let start = -1;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (text && separator) text += separator;
    if (node === range.startContainer) start = text.length + range.startOffset;
    text += node.textContent ?? '';
  }
  // Début de sélection sur un élément plutôt qu'un texte : on cherche le texte sélectionné.
  if (start < 0) start = text.indexOf(selected);
  if (start < 0 || !text.trim()) return undefined;
  return sentenceAround(text, start, start + selected.length) || undefined;
}

/** Bloc de texte (paragraphe, titre, élément de liste) qui contient le nœud. */
export function enclosingBlock(node: Node): Element | null {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  return element?.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6, td, div') ?? null;
}
