import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import ProgressBar from '../components/ProgressBar';
import { db, type Book, type BookLanguage, type Highlight, type Progress } from '../db/db';
import { useI18n } from '../i18n';
import type { LookupLanguage } from '../services/dictionary/types';
import { extractWord } from '../services/dictionary/words';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { useSettings } from '../hooks/useSettings';
import { getHighlights } from '../services/highlightService';
import { highlightsToMarkdown, sortHighlights } from '../services/highlights';
import { getEpubLocations, getProgress, saveEpubLocations, savePosition } from '../services/progressService';
import { downloadTextFile, safeFileName } from '../utils/download';
import { compareCfi } from './epubCfi';
import EpubView from './EpubView';
import { HighlightEditMenu, SelectionMenu } from './HighlightMenu';
import HighlightsPanel from './HighlightsPanel';
import PdfView from './PdfView';
import SettingsPanel from './SettingsPanel';
import TocPanel from './TocPanel';
import {
  THEME_COLORS,
  type ReaderErrorCode,
  type ReaderHandle,
  type ReaderLocation,
  type ScreenRect,
  type TextSelection,
  type TocItem,
} from './types';
import { useHighlightMenu } from './useHighlightMenu';
import WordPanel, { type LookupQuery } from './WordPanel';

type Panel = 'toc' | 'highlights' | 'settings' | null;

/** Référence stable tant que la requête n'a pas répondu. */
const NO_HIGHLIGHTS: Highlight[] = [];

/** Menu d'édition du surlignage cliqué (rien s'il vient d'être supprimé). */
function EditMenuFor({
  highlights,
  highlightId,
  rect,
  actions,
}: {
  highlights: Highlight[];
  highlightId: string;
  rect: ScreenRect;
  actions: ReturnType<typeof useHighlightMenu>;
}) {
  const highlight = highlights.find((h) => h.id === highlightId);
  if (!highlight) return null;
  return (
    <HighlightEditMenu
      key={highlight.id}
      highlight={highlight}
      rect={rect}
      onColor={(color) => actions.changeColor(highlight.id, color)}
      onNote={(note) => actions.saveNote(highlight.id, note)}
      onDelete={() => actions.remove(highlight.id)}
      onClose={actions.close}
    />
  );
}

const SWIPE_DISTANCE = 50;

/** Tout ce qu'il faut pour ouvrir un livre, chargé une seule fois. */
interface OpenedBook {
  book: Book;
  progress?: Progress;
  cachedLocations?: string;
}

async function openBook(bookId: string): Promise<OpenedBook | null> {
  const book = await db.books.get(bookId);
  if (!book) return null;
  const [progress, cachedLocations] = await Promise.all([
    getProgress(bookId),
    book.format === 'epub' ? getEpubLocations(bookId) : undefined,
  ]);
  await db.books.update(bookId, { lastOpenedAt: Date.now() });
  return { book, progress, cachedLocations };
}

export default function Reader({ bookId, onClose }: { bookId: string; onClose(): void }) {
  const { t } = useI18n();
  // Chargé une seule fois : une requête "live" recréerait le fichier à chaque
  // mise à jour et rouvrirait le livre.
  const [opened, setOpened] = useState<OpenedBook | null>();
  const [settings, updateSettings] = useSettings();
  const [toc, setToc] = useState<TocItem[]>([]);
  const [location, setLocation] = useState<ReaderLocation>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<ReaderErrorCode>();
  const [panel, setPanel] = useState<Panel>(null);
  const [lookup, setLookup] = useState<LookupQuery | null>(null);
  // Langue choisie depuis le dictionnaire quand elle était inconnue.
  const [languageOverride, setLanguageOverride] = useState<LookupLanguage>();
  const viewRef = useRef<ReaderHandle>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const markActivity = useReadingTimer(bookId, ready && !error);
  const highlightMenu = useHighlightMenu(bookId, viewRef);
  const { close: closeMenu, onSelection: openSelectionMenu } = highlightMenu;
  const bookLanguage: BookLanguage = languageOverride ?? opened?.book.language ?? 'unknown';

  // Un mot seul sélectionné (double-clic) s'ouvre directement au dictionnaire ;
  // le menu de surlignage reste proposé à côté.
  const onSelection = useCallback(
    (selection: TextSelection | null) => {
      openSelectionMenu(selection);
      const word = selection && extractWord(selection.text, bookLanguage);
      if (word) setLookup({ kind: 'word', word, context: selection.context });
    },
    [openSelectionMenu, bookLanguage],
  );

  const changeLanguage = useCallback(
    (language: LookupLanguage) => {
      setLanguageOverride(language);
      db.books.update(bookId, { language }).catch((err) => console.error('Langue non enregistrée', err));
    },
    [bookId],
  );

  // Requête "live" : un ajout, une modification ou une suppression s'affiche aussitôt.
  const highlights = useLiveQuery(() => getHighlights(bookId), [bookId]) ?? NO_HIGHLIGHTS;
  const sortedHighlights = useMemo(() => sortHighlights(highlights, compareCfi), [highlights]);

  // Un clic en dehors du menu flottant le ferme.
  const menuOpen = highlightMenu.menu !== null;
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    let cancelled = false;
    openBook(bookId)
      .then((result) => {
        if (!cancelled) setOpened(result);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('loadBook');
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const title = opened?.book.title;
  useEffect(() => {
    if (title) document.title = `${title} – ${t.app.name}`;
    return () => {
      document.title = t.app.name;
    };
  }, [title, t.app.name]);

  const handleKey = useCallback(
    (key: string) => {
      markActivity();
      if (key === 'ArrowRight' || key === 'PageDown') viewRef.current?.next();
      else if (key === 'ArrowLeft' || key === 'PageUp') viewRef.current?.prev();
      else if (key === 'Escape') {
        setPanel(null);
        closeMenu();
        setLookup(null);
      }
    },
    [markActivity, closeMenu],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest('input, select, textarea')) return;
      handleKey(event.key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  const onReady = useCallback((items: TocItem[]) => {
    setToc(items);
    setReady(true);
  }, []);

  // Chaque changement de page est enregistré aussitôt : une fermeture brutale
  // de l'onglet ne perd au plus que la page en cours.
  const onLocationChange = useCallback(
    (next: ReaderLocation) => {
      setLocation(next);
      markActivity();
      closeMenu(); // la sélection n'est plus à l'écran
      savePosition(bookId, next.position, next.percentage).catch((err) =>
        console.error('Position non enregistrée', err),
      );
    },
    [bookId, markActivity, closeMenu],
  );

  const exportHighlights = useCallback(() => {
    if (!opened) return;
    const markdown = highlightsToMarkdown(opened.book, sortedHighlights, {
      author: opened.book.author.trim() || t.common.unknownAuthor,
      count: t.highlights.markdown.count,
      note: t.highlights.markdown.note,
      color: (color) => t.highlights.colors[color],
    });
    downloadTextFile(`${safeFileName(opened.book.title)}-${t.reader.highlightsFile}.md`, markdown, 'text/markdown');
  }, [opened, sortedHighlights, t]);

  const onLocationsReady = useCallback(
    (locations: string) => {
      saveEpubLocations(bookId, locations).catch((err) => console.error('Repères EPUB non enregistrés', err));
    },
    [bookId],
  );

  if (opened === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p>{t.reader.missing}</p>
        <button onClick={onClose} className="rounded-lg bg-amber-700 px-4 py-2 text-white hover:bg-amber-800">
          {t.reader.backToLibrary}
        </button>
      </div>
    );
  }

  const colors = THEME_COLORS[settings.theme];
  const toolbarButton = 'rounded-md px-3 py-1.5 text-sm hover:bg-current/10 aria-pressed:bg-current/15';
  // Tant que les repères EPUB se calculent, on affiche le dernier avancement connu.
  const percentage = location?.percentage ?? opened?.progress?.percentage;

  return (
    <div className="flex h-screen flex-col" style={{ background: colors.background, color: colors.text }}>
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-current/10 px-2">
        <button onClick={onClose} className={toolbarButton} title={t.reader.backTitle}>
          {t.reader.back}
        </button>
        <button
          onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
          aria-pressed={panel === 'toc'}
          className={toolbarButton}
          title={t.reader.tocTitle}
        >
          {t.reader.toc}
        </button>
        <h1 className="mx-2 flex-1 truncate text-center text-sm font-medium opacity-80">{title}</h1>
        <button
          onClick={() => setPanel(panel === 'highlights' ? null : 'highlights')}
          aria-pressed={panel === 'highlights'}
          className={toolbarButton}
          title={t.reader.highlightsTitle}
        >
          {t.reader.highlights}
          {highlights.length > 0 && ` (${highlights.length})`}
        </button>
        <button
          onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
          aria-pressed={panel === 'settings'}
          className={toolbarButton}
          title={t.reader.settingsTitle}
        >
          {t.reader.settings}
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <main
          className="h-full"
          onTouchStart={(e) => {
            touchStartX.current = e.changedTouches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > SWIPE_DISTANCE) handleKey(dx < 0 ? 'ArrowRight' : 'ArrowLeft');
          }}
        >
          {opened &&
            !error &&
            (opened.book.format === 'pdf' ? (
              <PdfView
                ref={viewRef}
                file={opened.book.file}
                title={opened.book.title}
                settings={settings}
                initialPosition={opened.progress?.position}
                highlights={highlights}
                onReady={onReady}
                onLocationChange={onLocationChange}
                onError={setError}
                onKey={handleKey}
                onSelection={onSelection}
                onHighlightClick={highlightMenu.onHighlightClick}
              />
            ) : (
              <EpubView
                ref={viewRef}
                file={opened.book.file}
                title={opened.book.title}
                settings={settings}
                initialPosition={opened.progress?.position}
                highlights={highlights}
                onReady={onReady}
                onLocationChange={onLocationChange}
                onError={setError}
                onKey={handleKey}
                onSelection={onSelection}
                onHighlightClick={highlightMenu.onHighlightClick}
                cachedLocations={opened.cachedLocations}
                onLocationsReady={onLocationsReady}
              />
            ))}
          {(!ready || error) && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: colors.background }}
            >
              <p role={error ? 'alert' : 'status'} className={error ? 'text-red-600' : 'opacity-70'}>
                {error ? t.reader.errors[error] : t.reader.opening}
              </p>
            </div>
          )}
          {/* Menus flottants dans <main> : contenu rattaché à une région (accessibilité). */}
          <div ref={menuRef}>
            {highlightMenu.menu?.kind === 'selection' && (
              <SelectionMenu
                rect={highlightMenu.menu.selection.rect}
                onPick={highlightMenu.create}
                onTranslate={
                  extractWord(highlightMenu.menu.selection.text, bookLanguage)
                    ? undefined
                    : () => {
                        if (highlightMenu.menu?.kind === 'selection') {
                          setLookup({ kind: 'text', text: highlightMenu.menu.selection.text });
                        }
                        closeMenu();
                      }
                }
              />
            )}
            {highlightMenu.menu?.kind === 'edit' && (
              <EditMenuFor
                highlights={highlights}
                highlightId={highlightMenu.menu.highlightId}
                rect={highlightMenu.menu.rect}
                actions={highlightMenu}
              />
            )}
          </div>
        </main>

        {ready && (
          <>
            <button
              onClick={() => viewRef.current?.prev()}
              aria-label={t.reader.previousPage}
              className="absolute left-0 top-1/2 hidden h-24 w-10 -translate-y-1/2 items-center justify-center text-2xl opacity-30 hover:opacity-80 sm:flex"
            >
              ‹
            </button>
            <button
              onClick={() => viewRef.current?.next()}
              aria-label={t.reader.nextPage}
              className="absolute right-0 top-1/2 hidden h-24 w-10 -translate-y-1/2 items-center justify-center text-2xl opacity-30 hover:opacity-80 sm:flex"
            >
              ›
            </button>
          </>
        )}

        {panel && (
          <div className="absolute inset-0 z-10" onClick={() => setPanel(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute top-0 max-h-full overflow-hidden border-current/10 shadow-xl ${
                panel === 'toc'
                  ? 'left-0 h-full w-80 max-w-[85vw] border-r'
                  : panel === 'highlights'
                    ? 'right-0 h-full w-96 max-w-[90vw] border-l'
                    : 'right-2 mt-2 rounded-xl border'
              }`}
              style={{ background: colors.background }}
            >
              {panel === 'toc' && (
                <TocPanel
                  toc={toc}
                  onSelect={(item) => {
                    viewRef.current?.goTo(item);
                    setPanel(null);
                  }}
                />
              )}
              {panel === 'highlights' && (
                <HighlightsPanel
                  highlights={sortedHighlights}
                  onSelect={(highlight) => {
                    viewRef.current?.goToAnchor(highlight.anchor);
                    setPanel(null);
                  }}
                  onExport={exportHighlights}
                />
              )}
              {panel === 'settings' && opened && (
                <SettingsPanel format={opened.book.format} settings={settings} onChange={updateSettings} />
              )}
            </div>
          </div>
        )}

        {/* Dictionnaire : à droite sur grand écran, en bas sur mobile, sans masquer la lecture. */}
        {lookup && opened && (
          <div
            className="absolute inset-x-0 bottom-0 z-20 flex max-h-[60%] flex-col border-t border-current/10 shadow-xl sm:inset-x-auto sm:right-0 sm:top-0 sm:max-h-none sm:w-96 sm:border-l sm:border-t-0"
            style={{ background: colors.background }}
          >
            {/* Un problème du dictionnaire ne doit jamais interrompre la lecture. */}
            <ErrorBoundary compact resetKey={lookup} message={t.app.dictionaryError}>
              <WordPanel
                query={lookup}
                language={bookLanguage}
                book={{ id: opened.book.id, title: opened.book.title }}
                onLanguageChange={changeLanguage}
                onClose={() => setLookup(null)}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      <footer className="flex h-11 shrink-0 items-center gap-4 border-t border-current/10 px-4 text-xs">
        <span className="min-w-0 flex-1 truncate opacity-70">{location?.chapter ?? ''}</span>
        {percentage !== undefined && (
          <div className="flex w-40 shrink-0 items-center gap-2" title={t.reader.progress}>
            <ProgressBar value={percentage} label={t.reader.progress} className="flex-1" />
            <span className="w-9 text-right tabular-nums opacity-70">{t.format.percentage(percentage)}</span>
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-right tabular-nums opacity-70">
          {location &&
            (location.page.scope === 'book'
              ? t.reader.page(location.page.current, location.page.total)
              : t.reader.chapterPage(location.page.current, location.page.total))}
        </span>
      </footer>
    </div>
  );
}
