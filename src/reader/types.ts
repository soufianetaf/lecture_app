import type { Highlight, HighlightAnchor, ReaderPosition, Settings } from '../db/db';

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

/** Rectangle en coordonnées de la fenêtre, pour placer un menu flottant. */
export type ScreenRect = Pick<DOMRect, 'top' | 'left' | 'bottom' | 'right'>;

/** Texte sélectionné par le lecteur, prêt à être surligné. */
export interface TextSelection {
  anchor: HighlightAnchor;
  text: string;
  /** Chapitre ou page, enregistré avec le surlignage. */
  label?: string;
  /** Phrase du livre qui contient la sélection (pour le vocabulaire). */
  context?: string;
  rect: ScreenRect;
}

/** Ce que le lecteur peut demander à un moteur (EPUB ou PDF). */
export interface ReaderHandle {
  next(): void;
  prev(): void;
  goTo(item: TocItem): void;
  goToAnchor(anchor: HighlightAnchor): void;
  clearSelection(): void;
}

export interface ViewProps {
  file: Blob;
  settings: Settings;
  /** Position à laquelle reprendre la lecture. */
  initialPosition?: ReaderPosition;
  /** Surlignages du livre, à afficher. */
  highlights: Highlight[];
  onReady(toc: TocItem[]): void;
  onLocationChange(location: ReaderLocation): void;
  onError(message: string): void;
  /** Touches et gestes captés à l'intérieur du livre (iframe EPUB). */
  onKey(key: string): void;
  /** Texte sélectionné, ou `null` quand la sélection disparaît. */
  onSelection(selection: TextSelection | null): void;
  onHighlightClick(id: string, rect: ScreenRect): void;
}

export const THEME_COLORS: Record<Settings['theme'], { background: string; text: string }> = {
  light: { background: '#ffffff', text: '#1c1917' },
  sepia: { background: '#f4ecd8', text: '#5b4636' },
  dark: { background: '#1c1917', text: '#e7e5e4' },
};
