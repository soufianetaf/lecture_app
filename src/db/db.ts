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
  /** Langue de l'interface ; absente = détectée depuis le navigateur. */
  uiLanguage?: 'fr' | 'en';
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

export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue';

/** Rectangle en proportion de la page PDF (0 à 1) : indépendant du zoom. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Emplacement d'un surlignage, propre à chaque format. */
export type HighlightAnchor =
  { format: 'epub'; cfiRange: string } | { format: 'pdf'; page: number; rects: readonly NormalizedRect[] };

export interface Highlight {
  id: string;
  bookId: string;
  anchor: HighlightAnchor;
  /** Texte surligné, pour la liste et l'export. */
  text: string;
  color: HighlightColor;
  note?: string;
  /** Où se trouve le passage (chapitre, page), pour la liste. */
  label?: string;
  createdAt: number;
  updatedAt: number;
}

/** Résultat de dictionnaire ou de traduction mis en cache (`value: null` = introuvable). */
export interface DictCacheEntry {
  key: string;
  value: unknown;
  expiresAt: number;
}

export type WordStatus = 'new' | 'learning' | 'known';

/** État de révision espacée d'un mot (algorithme de type SM-2, comme Anki). */
export interface ReviewState {
  /** Date à laquelle le mot doit être révisé. */
  dueAt: number;
  /** Intervalle actuel entre deux révisions, en jours (0 = à revoir dans la séance). */
  intervalDays: number;
  /** Facilité : multiplicateur de l'intervalle après une bonne réponse. */
  ease: number;
  /** Bonnes réponses consécutives. */
  repetitions: number;
  /** Nombre d'oublis. */
  lapses: number;
  lastReviewedAt?: number;
}

export interface VocabularyWord extends ReviewState {
  id: string;
  /** Clé d'unicité : forme de base en minuscules (un mot n'est enregistré qu'une fois par langue). */
  key: string;
  language: 'fr' | 'en';
  /** Forme rencontrée dans le livre (« ran »). */
  word: string;
  /** Forme de base, si différente (« run »). */
  lemma?: string;
  translations: string[];
  definition?: string;
  /** Phrase du livre où le mot a été rencontré. */
  context?: string;
  bookId?: string;
  /** Gardé en clair : le vocabulaire survit à la suppression du livre. */
  bookTitle?: string;
  status: WordStatus;
  createdAt: number;
  updatedAt: number;
}

class LectureDB extends Dexie {
  books!: EntityTable<Book, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  progress!: EntityTable<Progress, 'bookId'>;
  readingSessions!: EntityTable<ReadingSession, 'id'>;
  epubLocations!: EntityTable<EpubLocationsCache, 'bookId'>;
  highlights!: EntityTable<Highlight, 'id'>;
  dictCache!: EntityTable<DictCacheEntry, 'key'>;
  words!: EntityTable<VocabularyWord, 'id'>;

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
    this.version(4).stores({
      highlights: 'id, bookId, createdAt',
    });
    this.version(5).stores({
      dictCache: 'key, expiresAt',
    });
    this.version(6).stores({
      words: 'id, &[language+key], bookId, status, dueAt, createdAt',
    });
    // L'auteur inconnu était enregistré en toutes lettres (« Auteur inconnu ») :
    // il est désormais vide et traduit à l'affichage.
    this.version(7).upgrade((tx) =>
      tx
        .table('books')
        .filter((book: Book) => book.author === 'Auteur inconnu')
        .modify({ author: '' }),
    );
  }
}

export const db = new LectureDB();
