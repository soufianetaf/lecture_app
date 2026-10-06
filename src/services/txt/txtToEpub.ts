// Conversion d'un fichier texte en EPUB à l'import : le TXT profite ainsi du
// lecteur EPUB (pagination, surlignage, dictionnaire, progression) sans code dédié.

import JSZip from 'jszip';

export interface TxtChapter {
  title: string;
  paragraphs: string[];
}

/** Au-delà, un texte sans titres de chapitre est découpé en parties (pagination plus fluide). */
const WORDS_PER_PART = 4000;
const MAX_HEADING_LENGTH = 80;
const HEADING = /^(chapitre|chapter|livre|book|partie|part|prologue|épilogue|epilogue|préface|preface)\b/i;
const ROMAN_NUMERAL = /^[IVXLCDM]+\.?$/;

/**
 * Décode un fichier texte : UTF-8 (avec ou sans BOM), sinon Windows-1252,
 * encodage courant des anciens fichiers texte français.
 */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function isHeading(paragraph: string): boolean {
  if (paragraph.includes('\n') || paragraph.length > MAX_HEADING_LENGTH) return false;
  return HEADING.test(paragraph) || ROMAN_NUMERAL.test(paragraph);
}

const wordCount = (paragraphs: string[]) => paragraphs.reduce((n, p) => n + p.split(/\s+/).length, 0);

/** Paragraphes du texte : séparés par des lignes vides, retours à la ligne internes recollés. */
export function splitParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  // Sans aucune ligne vide, chaque ligne est un paragraphe.
  const blocks = /\n\s*\n/.test(normalized) ? normalized.split(/\n\s*\n/) : normalized.split('\n');
  return blocks
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .join('\n'),
    )
    .filter((block) => block.trim().length > 0);
}

/** Chapitres détectés par leurs titres (« Chapitre 1 », « II »…), sinon parties de taille régulière. */
export function splitChapters(text: string, defaultTitle: string, partLabel = 'Partie'): TxtChapter[] {
  const paragraphs = splitParagraphs(text);
  const chapters: TxtChapter[] = [];
  let current: TxtChapter = { title: defaultTitle, paragraphs: [] };

  for (const paragraph of paragraphs) {
    if (isHeading(paragraph)) {
      if (current.paragraphs.length > 0) chapters.push(current);
      current = { title: paragraph, paragraphs: [] };
    } else {
      // Lignes coupées à largeur fixe (Gutenberg) : on recolle le paragraphe.
      current.paragraphs.push(paragraph.replace(/\n/g, ' '));
    }
  }
  if (current.paragraphs.length > 0 || chapters.length === 0) chapters.push(current);

  // Aucun titre trouvé dans un long texte : découpage en parties.
  if (chapters.length === 1 && wordCount(chapters[0].paragraphs) > WORDS_PER_PART) {
    const parts: TxtChapter[] = [];
    let part: string[] = [];
    for (const paragraph of chapters[0].paragraphs) {
      part.push(paragraph);
      if (wordCount(part) >= WORDS_PER_PART) {
        parts.push({ title: `${partLabel} ${parts.length + 1}`, paragraphs: part });
        part = [];
      }
    }
    if (part.length > 0) parts.push({ title: `${partLabel} ${parts.length + 1}`, paragraphs: part });
    return parts;
  }
  return chapters;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface EpubInput {
  title: string;
  author: string;
  language: string;
  chapters: TxtChapter[];
}

/** Construit un EPUB 3 minimal et valide (mimetype non compressé en premier). */
export async function buildEpub({ title, author, language, chapters }: EpubInput): Promise<Blob> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const ids = chapters.map((_, i) => `ch${i + 1}`);
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
${author ? `    <dc:creator>${escapeXml(author)}</dc:creator>\n` : ''}
    <dc:language>${escapeXml(language)}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${ids.map((id) => `    <item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine>${ids.map((id) => `<itemref idref="${id}"/>`).join('')}</spine>
</package>`,
  );

  const xhtml = (heading: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head><title>${escapeXml(heading)}</title></head>
<body>
${body}
</body>
</html>`;

  zip.file(
    'OEBPS/nav.xhtml',
    xhtml(
      title,
      `<nav epub:type="toc"><ol>${chapters
        .map((chapter, i) => `<li><a href="${ids[i]}.xhtml">${escapeXml(chapter.title)}</a></li>`)
        .join('')}</ol></nav>`,
    ),
  );
  chapters.forEach((chapter, i) => {
    const body = [`<h1>${escapeXml(chapter.title)}</h1>`, ...chapter.paragraphs.map((p) => `<p>${escapeXml(p)}</p>`)];
    zip.file(`OEBPS/${ids[i]}.xhtml`, xhtml(chapter.title, body.join('\n')));
  });

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
