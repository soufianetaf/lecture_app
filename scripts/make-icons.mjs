// Génère les icônes de l'application (PNG) : node scripts/make-icons.mjs
// Dessin vectoriel simple (livre ouvert sur fond ambre), anticrénelé par
// suréchantillonnage, encodé en PNG avec zlib (aucune dépendance).

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const BACKGROUND = [217, 119, 6]; // ambre-600, couleur d'accent de l'application
const PAGE = [255, 255, 255];
const LINE = [253, 230, 138]; // lignes de texte, ambre clair

// ---- Encodage PNG -----------------------------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits par canal
  header[9] = 6; // RVBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filtre « aucun »
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Dessin (coordonnées de 0 à 1) ------------------------------------------
function insideRoundedSquare(x, y, radius) {
  const dx = Math.max(radius - x, 0, x - (1 - radius));
  const dy = Math.max(radius - y, 0, y - (1 - radius));
  return dx * dx + dy * dy <= radius * radius;
}

/** Couleur du livre ouvert au point (x, y), ou null pour le fond. */
function book(x, y) {
  const distance = Math.abs(x - 0.5);
  if (distance < 0.012 || distance > 0.31) return null; // reliure et bords
  // Pages qui se creusent vers la reliure.
  const dip = 0.05 * (1 - distance / 0.31);
  const top = 0.3 + dip;
  const bottom = 0.72 + dip;
  if (y < top || y > bottom) return null;
  // Lignes de texte sur chaque page.
  const inText = distance > 0.06 && distance < 0.27 && y > top + 0.07 && y < bottom - 0.06;
  if (inText && Math.abs(((y - top - 0.07) % 0.07) - 0.035) < 0.012) return LINE;
  return PAGE;
}

function render(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4; // suréchantillonnage 4×4
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let [r, g, b, a] = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          if (!maskable && !insideRoundedSquare(x, y, 0.22)) continue;
          // Icône « maskable » : le dessin tient dans la zone sûre (80 % central).
          const scale = maskable ? 0.8 : 1;
          const color = book(0.5 + (x - 0.5) / scale, 0.5 + (y - 0.5) / scale) ?? BACKGROUND;
          r += color[0];
          g += color[1];
          b += color[2];
          a += 255;
        }
      }
      const n = samples * samples;
      const i = (py * size + px) * 4;
      // Moyenne pondérée par l'opacité (bords nets du carré arrondi).
      rgba[i] = a ? Math.round((r * 255) / a) : 0;
      rgba[i + 1] = a ? Math.round((g * 255) / a) : 0;
      rgba[i + 2] = a ? Math.round((b * 255) / a) : 0;
      rgba[i + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, rgba);
}

const icons = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }], // iOS ajoute ses propres coins arrondis
];
for (const [name, size, options] of icons) writeFileSync(new URL(name, outDir), render(size, options));
console.log(`Icônes créées dans public/icons/ : ${icons.map(([name]) => name).join(', ')}`);
