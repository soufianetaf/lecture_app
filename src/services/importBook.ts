import ePub from 'epubjs';
import { db, type Book, type BookFormat, type BookLanguage } from '../db/db';
import { detectLanguage, normalizeLanguage } from './language';
import { pdfjs } from './pdf';

export class ImportError extends Error {}

interface ExtractedInfo {
  title?: string;
  author?: string;
  language: BookLanguage;
  cover?: Blob;
}

const MIN_TEXT_LENGTH = 200;
const COVER_WIDTH = 320;

function detectFormat(file: File): BookFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') return 'epub';
  return null;
}

function titleFromFileName(name: string): string {
  return name
    .replace(/\.(pdf|epub)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ImportError(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function extractPdf(file: File): Promise<ExtractedInfo> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch {
    throw new ImportError('Ce PDF est illisible ou protégé par mot de passe.');
  }

  try {
    const { info } = (await pdf.getMetadata()) as { info: Record<string, unknown> };

    // On lit les premières pages jusqu'à avoir assez de texte pour vérifier
    // que le PDF n'est pas scanné et deviner sa langue.
    let text = '';
    const pagesToScan = Math.min(pdf.numPages, 10);
    for (let i = 1; i <= pagesToScan && text.length < 3000; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + ' ';
    }
    if (text.replace(/\s/g, '').length < MIN_TEXT_LENGTH) {
      throw new ImportError(
        'Ce PDF semble scanné : il ne contient pas de texte sélectionnable. Il ne peut pas être lu pour l’instant.',
      );
    }

    const firstPage = await pdf.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const viewport = firstPage.getViewport({ scale: COVER_WIDTH / baseViewport.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    // L'intention "print" évite requestAnimationFrame, mis en pause par le
    // navigateur quand l'onglet est en arrière-plan (l'import resterait bloqué).
    await firstPage.render({ canvas, viewport, intent: 'print' }).promise;
    const cover = await new Promise<Blob | undefined>((resolve) =>
      canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/jpeg', 0.85),
    );

    const metaLanguage = normalizeLanguage(info.Language as string | undefined);
    return {
      title: typeof info.Title === 'string' ? info.Title.trim() : undefined,
      author: typeof info.Author === 'string' ? info.Author.trim() : undefined,
      language: metaLanguage !== 'unknown' ? metaLanguage : detectLanguage(text),
      cover,
    };
  } finally {
    await loadingTask.destroy();
  }
}

async function extractEpub(file: File): Promise<ExtractedInfo> {
  const book = ePub(await file.arrayBuffer());
  try {
    const metadata = await withTimeout(book.loaded.metadata, 15000, 'Cet EPUB est illisible ou mal formé.').catch(
      (error) => {
        throw error instanceof ImportError ? error : new ImportError('Cet EPUB est illisible ou mal formé.');
      },
    );

    let cover: Blob | undefined;
    try {
      const coverUrl = await book.coverUrl();
      if (coverUrl) cover = await (await fetch(coverUrl)).blob();
    } catch {
      // Pas de couverture : on affichera un visuel par défaut.
    }

    let language = normalizeLanguage(metadata.language);
    if (language === 'unknown') {
      // Pas de langue dans les métadonnées : on lit le début du livre.
      let text = '';
      for (let i = 0; i < 5 && text.length < 3000; i++) {
        const section = book.spine.get(i);
        if (!section) break;
        const doc = (await section.load(book.load.bind(book))) as unknown as Document | Element;
        text += (doc.textContent ?? '') + ' ';
        section.unload();
      }
      language = detectLanguage(text);
    }

    return {
      title: metadata.title?.trim() || undefined,
      author: metadata.creator?.trim() || undefined,
      language,
      cover,
    };
  } finally {
    book.destroy();
  }
}

/** Importe un fichier PDF ou EPUB dans la bibliothèque. */
export async function importBook(file: File): Promise<Book> {
  const format = detectFormat(file);
  if (!format) {
    throw new ImportError('Format non pris en charge : seuls les fichiers PDF et EPUB sont acceptés.');
  }

  const duplicate = await db.books.where({ fileName: file.name, size: file.size }).first();
  if (duplicate) {
    throw new ImportError(`« ${duplicate.title} » est déjà dans la bibliothèque.`);
  }

  const info = format === 'pdf' ? await extractPdf(file) : await extractEpub(file);

  const book: Book = {
    id: crypto.randomUUID(),
    title: info.title || titleFromFileName(file.name),
    author: info.author || 'Auteur inconnu',
    language: info.language,
    format,
    file,
    fileName: file.name,
    size: file.size,
    cover: info.cover,
    addedAt: Date.now(),
  };
  await db.books.add(book);
  return book;
}
