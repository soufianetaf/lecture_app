import { describe, expect, it } from 'vitest';
import type { Highlight, HighlightAnchor } from '../db/db';
import { cleanSelectionText, compareAnchors, highlightsToMarkdown, sortHighlights } from './highlights';

const byString = (a: string, b: string) => a.localeCompare(b);

function highlight(partial: Partial<Highlight> & { anchor: HighlightAnchor }): Highlight {
  return {
    id: crypto.randomUUID(),
    bookId: 'livre',
    text: 'texte',
    color: 'yellow',
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('compareAnchors', () => {
  it('trie les PDF par page puis par position sur la page', () => {
    const page2 = { format: 'pdf', page: 2, rects: [{ x: 0.1, y: 0.1, width: 0.1, height: 0.02 }] } as const;
    const page1Low = { format: 'pdf', page: 1, rects: [{ x: 0.1, y: 0.8, width: 0.1, height: 0.02 }] } as const;
    const page1High = { format: 'pdf', page: 1, rects: [{ x: 0.1, y: 0.2, width: 0.1, height: 0.02 }] } as const;
    const sorted = [page2, page1Low, page1High].sort((a, b) => compareAnchors(a, b, byString));
    expect(sorted).toEqual([page1High, page1Low, page2]);
  });

  it('délègue la comparaison des CFI EPUB', () => {
    const a = { format: 'epub', cfiRange: 'a' } as const;
    const b = { format: 'epub', cfiRange: 'b' } as const;
    expect(compareAnchors(a, b, byString)).toBeLessThan(0);
  });
});

describe('sortHighlights', () => {
  it('départage les positions égales par date de création', () => {
    const anchor = { format: 'epub', cfiRange: 'x' } as const;
    const late = highlight({ anchor, createdAt: 2 });
    const early = highlight({ anchor, createdAt: 1 });
    expect(sortHighlights([late, early], byString)).toEqual([early, late]);
  });
});

describe('cleanSelectionText', () => {
  it('réduit les espaces et retours à la ligne', () => {
    expect(cleanSelectionText('  Il était\n  une   fois ')).toBe('Il était une fois');
  });
});

describe('highlightsToMarkdown', () => {
  it('groupe par chapitre et inclut les notes', () => {
    const anchor = { format: 'epub', cfiRange: 'x' } as const;
    const markdown = highlightsToMarkdown({ title: 'Le Jardin', author: 'Marie' }, [
      highlight({ anchor, text: 'Première phrase', label: 'Chapitre 1' }),
      highlight({ anchor, text: 'Deuxième phrase', label: 'Chapitre 1', note: 'À retenir', color: 'green' }),
      highlight({ anchor, text: 'Troisième phrase', label: 'Chapitre 2' }),
    ]);
    expect(markdown).toContain('# Le Jardin');
    expect(markdown).toContain('3 surlignage(s)');
    expect(markdown.match(/## Chapitre 1/g)).toHaveLength(1);
    expect(markdown).toContain('## Chapitre 2');
    expect(markdown).toContain('> Deuxième phrase\n\n**Note :** À retenir');
    expect(markdown).toContain('*Vert*');
  });
});
