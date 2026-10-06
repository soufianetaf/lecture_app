import { forwardRef, useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from 'react';
import ePub, { type Book as EpubBook, type Contents, type NavItem, type Rendition } from 'epubjs';
import type { HighlightColor, Settings } from '../db/db';
import { cleanSelectionText, colorFill } from '../services/highlights';
import { enclosingBlock, selectionSentence } from './selectionContext';
import { THEME_COLORS, type ReaderHandle, type ScreenRect, type TocItem, type ViewProps } from './types';

const STYLE_ID = 'lecture-reader-style';

/** Nombre de caractères par repère : compromis entre précision et durée de calcul. */
const CHARS_PER_LOCATION = 1600;

const FONTS: Record<Settings['fontFamily'], string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

const COLUMN_WIDTHS: Record<Settings['columnWidth'], number> = {
  narrow: 560,
  medium: 720,
  wide: 960,
};

const SWIPE_DISTANCE = 50;

interface EpubLocationStart {
  cfi: string;
  href: string;
  displayed: { page: number; total: number };
}

export interface EpubViewProps extends ViewProps {
  /** Repères de position déjà calculés (cache). */
  cachedLocations?: string;
  /** Appelé une fois les repères calculés, pour les mettre en cache. */
  onLocationsReady(locations: string): void;
}

/** Feuille de style injectée dans chaque chapitre : thème, police, interligne. */
function readerCss(settings: Settings): string {
  const colors = THEME_COLORS[settings.theme];
  return `
    html, body { background: ${colors.background} !important; color: ${colors.text} !important; }
    body * {
      color: inherit !important;
      background-color: transparent !important;
      font-family: ${FONTS[settings.fontFamily]} !important;
      line-height: ${settings.lineHeight} !important;
    }
    a { text-decoration: underline; }
    img, svg { max-width: 100%; }
  `;
}

function applyStyle(contents: Contents, settings: Settings) {
  const doc = contents.document;
  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = readerCss(settings);
}

function toTocItems(items: NavItem[]): TocItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label.trim(),
    target: item.href,
    children: toTocItems(item.subitems ?? []),
  }));
}

/** Styles SVG d'un surlignage epub.js ; en thème sombre, « multiply » le rendrait noir. */
function highlightStyles(color: HighlightColor, theme: Settings['theme']) {
  return {
    fill: colorFill(color),
    'fill-opacity': theme === 'dark' ? '0.35' : '0.45',
    'mix-blend-mode': theme === 'dark' ? 'normal' : 'multiply',
  };
}

/** Rectangle d'une plage de l'iframe, ramené aux coordonnées de la fenêtre principale. */
function rangeToScreenRect(range: Range, contents: Contents): ScreenRect {
  const rect = range.getBoundingClientRect();
  const frame = contents.window.frameElement?.getBoundingClientRect();
  const dx = frame?.left ?? 0;
  const dy = frame?.top ?? 0;
  return { top: rect.top + dy, bottom: rect.bottom + dy, left: rect.left + dx, right: rect.right + dx };
}

/** Titre du chapitre dont le fichier correspond à la section affichée. */
function chapterForHref(toc: TocItem[], href: string): string | undefined {
  for (const item of toc) {
    const target = (item.target as string).split('#')[0];
    if (target && (href.endsWith(target) || target.endsWith(href))) return item.label;
    const child = chapterForHref(item.children, href);
    if (child) return child;
  }
  return undefined;
}

const EpubView = forwardRef<ReaderHandle, EpubViewProps>(function EpubView(props, ref) {
  const { file, settings, highlights } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition>(undefined);
  // Le rendu affiché, en état pour que l'effet des surlignages se relance à l'ouverture.
  const [activeRendition, setActiveRendition] = useState<Rendition>();

  // Fonctions appelées depuis les effets : elles voient toujours les dernières
  // props sans relancer l'ouverture du livre.
  const getSettings = useEffectEvent(() => settings);
  const getInitialState = useEffectEvent(() => ({
    cfi: props.initialPosition?.format === 'epub' ? props.initialPosition.cfi : undefined,
    cachedLocations: props.cachedLocations,
  }));
  const onReady = useEffectEvent((toc: TocItem[]) => props.onReady(toc));
  const onLocationChange = useEffectEvent((...args: Parameters<ViewProps['onLocationChange']>) =>
    props.onLocationChange(...args),
  );
  const onLocationsReady = useEffectEvent((locations: string) => props.onLocationsReady(locations));
  const onError = useEffectEvent((message: string) => props.onError(message));
  const onKey = useEffectEvent((key: string) => props.onKey(key));
  const onSelection = useEffectEvent((...args: Parameters<ViewProps['onSelection']>) => props.onSelection(...args));
  const onHighlightClick = useEffectEvent((id: string, rect: ScreenRect) => props.onHighlightClick(id, rect));

  useImperativeHandle(
    ref,
    () => ({
      next: () => void renditionRef.current?.next(),
      prev: () => void renditionRef.current?.prev(),
      goTo: (item) => void renditionRef.current?.display(item.target as string),
      goToAnchor: (anchor) => {
        if (anchor.format === 'epub') void renditionRef.current?.display(anchor.cfiRange);
      },
      clearSelection: () => {
        for (const contents of (renditionRef.current?.getContents() ?? []) as unknown as Contents[]) {
          contents.window.getSelection()?.removeAllRanges();
        }
      },
    }),
    [],
  );

  // Ouverture du livre.
  useEffect(() => {
    let cancelled = false;
    let book: EpubBook | undefined;

    const opening = (async () => {
      const buffer = await file.arrayBuffer();
      if (cancelled) return;
      const epub = ePub(buffer);
      book = epub;
      // On attend l'ouverture, et on abandonne si l'écran a été quitté entre-temps.
      await epub.opened;
      if (cancelled) return;
      const rendition = epub.renderTo(containerRef.current!, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
        allowScriptedContent: false,
      });
      renditionRef.current = rendition;

      rendition.hooks.content.register((contents: Contents) => applyStyle(contents, getSettings()));
      rendition.themes.fontSize(`${getSettings().fontSize}%`);

      let toc: TocItem[] = [];
      let lastStart: EpubLocationStart | undefined;
      const emitLocation = (start: EpubLocationStart) => {
        const hasLocations = epub.locations.length() > 0;
        onLocationChange({
          position: { format: 'epub', cfi: start.cfi },
          percentage: hasLocations ? epub.locations.percentageFromCfi(start.cfi) : undefined,
          chapter: chapterForHref(toc, start.href),
          label: `Page ${start.displayed.page} / ${start.displayed.total} du chapitre`,
        });
      };
      rendition.on('relocated', (location: { start: EpubLocationStart }) => {
        lastStart = location.start;
        emitLocation(location.start);
      });

      // Sélection de texte : epub.js fournit la plage sous forme de CFI.
      rendition.on('selected', (cfiRange: string, contents: Contents) => {
        const range = contents.range(cfiRange);
        const text = cleanSelectionText(range.toString());
        if (!text) return;
        const block = enclosingBlock(range.startContainer);
        onSelection({
          anchor: { format: 'epub', cfiRange },
          text,
          label: lastStart ? chapterForHref(toc, lastStart.href) : undefined,
          context: block ? selectionSentence(range, block, '') : undefined,
          rect: rangeToScreenRect(range, contents),
        });
      });
      rendition.on('mousedown', () => onSelection(null));

      // Les événements clavier et tactiles se produisent dans l'iframe du livre.
      rendition.on('keydown', (event: KeyboardEvent) => onKey(event.key));
      let touchStartX = 0;
      rendition.on('touchstart', (event: TouchEvent) => {
        touchStartX = event.changedTouches[0].clientX;
      });
      rendition.on('touchend', (event: TouchEvent) => {
        const dx = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > SWIPE_DISTANCE) onKey(dx < 0 ? 'ArrowRight' : 'ArrowLeft');
      });

      const { cfi, cachedLocations } = getInitialState();
      const navigation = await epub.loaded.navigation;
      toc = toTocItems(navigation.toc);
      try {
        await rendition.display(cfi);
      } catch {
        // Position enregistrée invalide (livre modifié ?) : début du livre.
        await rendition.display();
      }
      if (cancelled) return;
      setActiveRendition(rendition);
      onReady(toc);

      // Repères pour calculer l'avancement : depuis le cache, sinon calculés
      // en arrière-plan après l'affichage pour ne pas retarder l'ouverture.
      if (cachedLocations) {
        epub.locations.load(cachedLocations);
      } else {
        await epub.locations.generate(CHARS_PER_LOCATION);
        if (cancelled) return;
        onLocationsReady(epub.locations.save());
      }
      if (lastStart) emitLocation(lastStart);
    })().catch((error) => {
      if (cancelled) return;
      console.error(error);
      onError('Impossible d’ouvrir cet EPUB.');
    });

    return () => {
      cancelled = true;
      renditionRef.current = undefined;
      setActiveRendition(undefined);
      // epub.js plante si on détruit le livre pendant une opération en cours
      // (démarrage, affichage) : on attend la fin de l'ouverture, qui s'arrête
      // d'elle-même à la prochaine étape grâce à `cancelled`.
      void opening.finally(() => book?.destroy());
    };
  }, [file]);

  // Surlignages : on ne redessine que ceux qui ont changé (ajout, couleur, thème).
  const drawnRef = useRef<{ rendition?: Rendition; marks: Map<string, { cfiRange: string; key: string }> }>({
    marks: new Map(),
  });
  useEffect(() => {
    const rendition = activeRendition;
    if (!rendition) return;
    // Nouveau rendu (autre livre) : les anciennes marques n'existent plus.
    if (drawnRef.current.rendition !== rendition) drawnRef.current = { rendition, marks: new Map() };
    const drawn = drawnRef.current.marks;
    const wanted = new Map(
      highlights.flatMap((h) =>
        h.anchor.format === 'epub' ? [[h.id, { highlight: h, cfiRange: h.anchor.cfiRange }] as const] : [],
      ),
    );

    for (const [id, mark] of drawn) {
      const next = wanted.get(id);
      if (!next || `${next.highlight.color}|${settings.theme}` !== mark.key) {
        rendition.annotations.remove(mark.cfiRange, 'highlight');
        drawn.delete(id);
      }
    }
    for (const [id, { highlight, cfiRange }] of wanted) {
      if (drawn.has(id)) continue;
      rendition.annotations.highlight(
        cfiRange,
        { id },
        (event: MouseEvent) => {
          const target = event.currentTarget as Element | null;
          const rect = target?.getBoundingClientRect();
          if (rect) onHighlightClick(id, rect);
        },
        'lecture-highlight',
        highlightStyles(highlight.color, settings.theme),
      );
      drawn.set(id, { cfiRange, key: `${highlight.color}|${settings.theme}` });
    }
  }, [activeRendition, highlights, settings.theme]);

  // Thème, police et interligne : mise à jour des chapitres affichés.
  useEffect(() => {
    if (!activeRendition) return;
    for (const contents of activeRendition.getContents() as unknown as Contents[]) applyStyle(contents, settings);
    activeRendition.themes.fontSize(`${settings.fontSize}%`);
  }, [activeRendition, settings]);

  // Largeur de colonne : epub.js doit recalculer la pagination.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    let lastSize: string | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // La première mesure est la taille d'ouverture : epub.js la connaît déjà,
      // repaginer effacerait la page en cours d'affichage.
      const size = `${Math.round(width)}x${Math.round(height)}`;
      const isFirst = lastSize === undefined;
      if (size === lastSize) return;
      lastSize = size;
      if (isFirst) return;
      clearTimeout(timer);
      timer = setTimeout(() => renditionRef.current?.resize(width, height), 150);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="h-full px-4 py-6" style={{ background: THEME_COLORS[settings.theme].background }}>
      <div ref={containerRef} className="mx-auto h-full" style={{ maxWidth: COLUMN_WIDTHS[settings.columnWidth] }} />
    </div>
  );
});

export default EpubView;
