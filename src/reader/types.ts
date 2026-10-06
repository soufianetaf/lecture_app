import type { ReaderPosition, Settings } from '../db/db';

/** Entrée de table des matières, commune aux deux formats. */
export interface TocItem {
  id: string;
  label: string;
  /** EPUB : href du chapitre. PDF : destination pdf.js (résolue au clic). */
  target: unknown;
  children: TocItem[];
}

/** Position courante, signalée par la vue à chaque changement de page. */
export interface ReaderLocation {
  /** Position à enregistrer pour reprendre la lecture. */
  position: ReaderPosition;
  /** Avancement dans le livre (0 à 1), inconnu tant que les repères EPUB se calculent. */
  percentage?: number;
  /** Chapitre ou section en cours, si connu. */
  chapter?: string;
  /** Texte de position, ex. « Page 3 / 120 ». */
  label: string;
}

/** Ce que le lecteur peut demander à un moteur (EPUB ou PDF). */
export interface ReaderHandle {
  next(): void;
  prev(): void;
  goTo(item: TocItem): void;
}

export interface ViewProps {
  file: Blob;
  settings: Settings;
  /** Position à laquelle reprendre la lecture. */
  initialPosition?: ReaderPosition;
  onReady(toc: TocItem[]): void;
  onLocationChange(location: ReaderLocation): void;
  onError(message: string): void;
  /** Touches et gestes captés à l'intérieur du livre (iframe EPUB). */
  onKey(key: string): void;
}

export const THEME_COLORS: Record<Settings['theme'], { background: string; text: string }> = {
  light: { background: '#ffffff', text: '#1c1917' },
  sepia: { background: '#f4ecd8', text: '#5b4636' },
  dark: { background: '#1c1917', text: '#e7e5e4' },
};
