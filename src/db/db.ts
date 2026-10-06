import { Dexie, type EntityTable } from 'dexie';

export type BookFormat = 'pdf' | 'epub';
export type BookLanguage = 'fr' | 'en' | 'unknown';

export interface Book {
  id: string;
  title: string;
  author: string;
  language: BookLanguage;
  format: BookFormat;
  file: Blob;
  fileName: string;
  size: number;
  cover?: Blob;
  addedAt: number;
  lastOpenedAt?: number;
}

export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type ReaderFont = 'serif' | 'sans';
export type ColumnWidth = 'narrow' | 'medium' | 'wide';

export interface Settings {
  id: 'app';
  theme: ReaderTheme;
  /** EPUB uniquement. */
  fontFamily: ReaderFont;
  /** EPUB uniquement, en % de la taille d'origine. */
  fontSize: number;
  /** EPUB uniquement. */
  lineHeight: number;
  /** EPUB uniquement : largeur de la colonne de texte (les marges). */
  columnWidth: ColumnWidth;
  /** PDF uniquement : 1 = page ajustée à la largeur. */
  pdfZoom: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'light',
  fontFamily: 'serif',
  fontSize: 100,
  lineHeight: 1.6,
  columnWidth: 'medium',
  pdfZoom: 1,
};

/** Position de lecture, propre à chaque format. */
export type ReaderPosition = { format: 'pdf'; page: number } | { format: 'epub'; cfi: string };

export interface Progress {
  bookId: string;
  /** Absente si le livre n'a jamais été affiché (temps compté avant la 1re page). */
  position?: ReaderPosition;
  /** Avancement entre 0 et 1. */
  percentage: number;
  /** Temps de lecture actif cumulé, en millisecondes. */
  totalReadingMs: number;
  updatedAt: number;
}

export interface ReadingSession {
  id?: number;
  bookId: string;
  startedAt: number;
  endedAt: number;
  /** Temps actif (hors inactivité et onglet caché), en millisecondes. */
  durationMs: number;
}

/** Repères de position EPUB : longs à calculer, on les garde en cache. */
export interface EpubLocationsCache {
  bookId: string;
  locations: string;
}

class LectureDB extends Dexie {
  books!: EntityTable<Book, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  progress!: EntityTable<Progress, 'bookId'>;
  readingSessions!: EntityTable<ReadingSession, 'id'>;
  epubLocations!: EntityTable<EpubLocationsCache, 'bookId'>;

  constructor() {
    super('lecture');
    this.version(1).stores({
      books: 'id, title, author, addedAt, lastOpenedAt, [fileName+size]',
    });
    this.version(2).stores({
      settings: 'id',
    });
    this.version(3).stores({
      progress: 'bookId, updatedAt',
      readingSessions: '++id, bookId, startedAt',
      epubLocations: 'bookId',
    });
  }
}

export const db = new LectureDB();
