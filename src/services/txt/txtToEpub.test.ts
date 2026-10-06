import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEpub, decodeText, escapeXml, splitChapters, splitParagraphs } from './txtToEpub';

describe('decodeText', () => {
  it('lit l’UTF-8, avec ou sans BOM', () => {
    const utf8 = new TextEncoder().encode('Léa décida.');
    expect(decodeText(utf8.buffer)).toBe('Léa décida.');
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
    expect(decodeText(withBom.buffer)).toBe('Léa décida.');
  });

  it('se rabat sur Windows-1252 pour un ancien fichier français', () => {
    // « Léa » encodé en Latin-1 : 0xE9 n'est pas de l'UTF-8 valide.
    const latin1 = new Uint8Array([0x4c, 0xe9, 0x61, 0x20, 0x80]);
    expect(decodeText(latin1.buffer)).toBe('Léa €');
  });
});

describe('splitParagraphs', () => {
  it('sépare sur les lignes vides et normalise les fins de ligne', () => {
    expect(splitParagraphs('Un.\r\n\r\nDeux\r\nsuite.\n\n\n Trois. ')).toEqual(['Un.', 'Deux\nsuite.', 'Trois.']);
  });

  it('traite chaque ligne comme un paragraphe sans ligne vide', () => {
    expect(splitParagraphs('Ligne 1\nLigne 2')).toEqual(['Ligne 1', 'Ligne 2']);
  });

  it('renvoie une liste vide pour un texte vide', () => {
    expect(splitParagraphs(' \n \n')).toEqual([]);
  });
});

describe('splitChapters', () => {
  it('découpe sur les titres de chapitre et recolle les lignes coupées', () => {
    const text = 'Préambule.\n\nCHAPITRE I\n\nIl était\nune fois.\n\nChapitre 2 : La suite\n\nFin.';
    expect(splitChapters(text, 'Mon livre')).toEqual([
      { title: 'Mon livre', paragraphs: ['Préambule.'] },
      { title: 'CHAPITRE I', paragraphs: ['Il était une fois.'] },
      { title: 'Chapitre 2 : La suite', paragraphs: ['Fin.'] },
    ]);
  });

  it('reconnaît les chiffres romains seuls', () => {
    expect(splitChapters('I\n\nUn.\n\nII.\n\nDeux.', 'Livre').map((c) => c.title)).toEqual(['I', 'II.']);
  });

  it('ne prend pas une phrase commençant par « Part » pour un titre trop long', () => {
    const long = `Part of the story ${'is long '.repeat(15)}`;
    expect(splitChapters(`${long}\n\nSuite.`, 'Livre')).toHaveLength(1);
  });

  it('découpe un long texte sans titres en parties', () => {
    const paragraph = 'mot '.repeat(1000).trim();
    const chapters = splitChapters(Array(9).fill(paragraph).join('\n\n'), 'Livre');
    expect(chapters.map((c) => c.title)).toEqual(['Partie 1', 'Partie 2', 'Partie 3']);
    expect(chapters.flatMap((c) => c.paragraphs)).toHaveLength(9);
  });
});

describe('escapeXml', () => {
  it('échappe les caractères spéciaux XML', () => {
    expect(escapeXml(`<a & "b" 'c'>`)).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;');
  });
});

describe('buildEpub', () => {
  it('produit un EPUB valide : mimetype non compressé en premier, sommaire, texte échappé', async () => {
    const blob = await buildEpub({
      title: 'Tom & Jerry',
      author: 'Anonyme',
      language: 'fr',
      chapters: [
        { title: 'Un', paragraphs: ['Il dit <bonjour>.'] },
        { title: 'Deux', paragraphs: ['Fin.'] },
      ],
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Le nom du premier fichier de l'archive commence à l'octet 30.
    expect(new TextDecoder().decode(bytes.slice(30, 38))).toBe('mimetype');

    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<dc:title>Tom &amp; Jerry</dc:title>');
    expect(opf).toContain('<dc:language>fr</dc:language>');
    expect(opf).toContain('<itemref idref="ch1"/><itemref idref="ch2"/>');
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
    expect(nav).toContain('<a href="ch2.xhtml">Deux</a>');
    expect(await zip.file('OEBPS/ch1.xhtml')!.async('string')).toContain('<p>Il dit &lt;bonjour&gt;.</p>');
  });
});
