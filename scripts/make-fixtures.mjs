// Génère des livres de test dans fixtures/ : node scripts/make-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';

const outDir = new URL('../fixtures/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const pdfString = (text) => `(${text.replace(/([()\\])/g, '\\$1')})`;

/**
 * Construit un PDF minimal avec des tables xref correctes.
 * Objets : 1 catalogue, 2 arbre des pages, 3 police, 4 infos,
 * puis une paire (page, contenu) par page, puis le sommaire.
 */
function buildPdf({ pages, outline = [], info }) {
  const pageObj = (i) => 5 + 2 * i;
  const outlineRoot = 5 + 2 * pages.length;
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R${outline.length ? ` /Outlines ${outlineRoot} 0 R /PageMode /UseOutlines` : ''} >>`,
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    info,
  ];
  pages.forEach((stream, i) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${pageObj(i) + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
  });
  if (outline.length) {
    const item = (j) => outlineRoot + 1 + j;
    objects.push(
      `<< /Type /Outlines /First ${item(0)} 0 R /Last ${item(outline.length - 1)} 0 R /Count ${outline.length} >>`,
    );
    outline.forEach(({ title, page }, j) => {
      const prev = j > 0 ? ` /Prev ${item(j - 1)} 0 R` : '';
      const next = j < outline.length - 1 ? ` /Next ${item(j + 1)} 0 R` : '';
      objects.push(
        `<< /Title ${pdfString(title)} /Parent ${outlineRoot} 0 R${prev}${next} /Dest [${pageObj(page - 1)} 0 R /XYZ 0 792 0] >>`,
      );
    });
  }

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const textPage = (lines) =>
  'BT /F1 14 Tf 72 720 Td 20 TL ' + lines.map((line) => `${pdfString(line)} Tj T*`).join(' ') + ' ET';

const englishChapters = [
  [
    'Chapter One',
    '',
    'It was a bright cold day in April, and the clocks were striking thirteen.',
    'The old house at the end of the street had been empty for many years.',
    'Nobody remembered who had lived there, but everyone had a story about it.',
    'Some said a sailor had built it with wood from his shipwrecked boat,',
    'and others whispered that the garden was full of forgotten treasures.',
    'Emma did not believe any of these stories, yet every morning on her way',
    'to school she slowed down in front of the rusty gate and looked inside.',
  ],
  [
    'Chapter Two',
    '',
    'One rainy afternoon, Emma noticed that the gate had been left ajar.',
    'A narrow path, half hidden by brambles, led towards the front door.',
    'She hesitated for a long moment, listening to the rain on the leaves,',
    'then pushed the gate and stepped carefully into the overgrown garden.',
  ],
  [
    'Chapter Three',
    '',
    'The front door was locked, but a small window beside it was broken.',
    'Through the gap, Emma could see a dusty hall and a staircase of dark oak.',
    'On the bottom step lay a leather notebook, its pages swollen with damp.',
    'She knew, at that very instant, that her life was about to change.',
  ],
];
writeFileSync(
  new URL('the-empty-house.pdf', outDir),
  buildPdf({
    pages: englishChapters.map(textPage),
    outline: englishChapters.map((lines, i) => ({ title: lines[0], page: i + 1 })),
    info: '<< /Title (The Empty House) /Author (Jane Doe) >>',
  }),
);

// Un "scan" : uniquement des formes, aucun texte.
writeFileSync(
  new URL('scanned.pdf', outDir),
  buildPdf({
    pages: ['0.6 g 72 300 468 420 re f 0 g 100 650 m 500 650 l S'],
    info: '<< /Title (Scan) >>',
  }),
);

// EPUB français sans langue dans les métadonnées : la détection doit trouver "fr".
const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file(
  'META-INF/container.xml',
  `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
);
zip.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">test-petit-prince-du-quartier</dc:identifier>
    <dc:title>Le Jardin oublié</dc:title>
    <dc:creator>Marie Dupont</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="ch3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch1"/><itemref idref="ch2"/><itemref idref="ch3"/></spine>
</package>`,
);
const frenchChapters = ['Chapitre premier', 'Chapitre deux', 'Chapitre trois'];
zip.file(
  'OEBPS/nav.xhtml',
  `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Sommaire</title></head>
<body><nav epub:type="toc"><ol>${frenchChapters
    .map((title, i) => `<li><a href="ch${i + 1}.xhtml">${title}</a></li>`)
    .join('')}</ol></nav></body></html>`,
);
const frenchParagraphs = [
  "Il était une fois, dans une petite ville au bord de la mer, une vieille maison entourée d'un jardin que personne ne visitait plus.",
  "Les enfants du quartier racontaient que des trésors y étaient cachés depuis la guerre, mais aucun d'eux n'avait jamais osé franchir le portail rouillé.",
  "Un matin d'automne, Léa décida pourtant de pousser la grille. Elle avait peur, bien sûr, mais sa curiosité était plus forte que tout.",
  "Les herbes folles lui arrivaient aux genoux et l'air sentait la terre mouillée. Au fond du jardin, un vieux puits de pierre semblait l'attendre.",
];
frenchChapters.forEach((title, i) => {
  // Assez de texte pour que chaque chapitre tienne sur plusieurs pages.
  const body = Array.from({ length: 6 }, () => frenchParagraphs.map((p) => `<p>${p}</p>`).join('\n')).join('\n');
  zip.file(
    `OEBPS/ch${i + 1}.xhtml`,
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head>
<body>
<h1>${title}</h1>
${body}
</body></html>`,
  );
});
writeFileSync(new URL('le-jardin-oublie.epub', outDir), await zip.generateAsync({ type: 'nodebuffer' }));

writeFileSync(new URL('notes.txt', outDir), 'Ceci n’est pas un livre.');

console.log('Fichiers de test créés dans fixtures/');
