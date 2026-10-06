import { useCallback, useEffect, useRef, useState } from 'react';
import ProgressBar from '../components/ProgressBar';
import { db, type Book, type Progress } from '../db/db';
import { useReadingTimer } from '../hooks/useReadingTimer';
import { useSettings } from '../hooks/useSettings';
import { formatPercentage } from '../services/progress';
import { getEpubLocations, getProgress, saveEpubLocations, savePosition } from '../services/progressService';
import EpubView from './EpubView';
import PdfView from './PdfView';
import SettingsPanel from './SettingsPanel';
import TocPanel from './TocPanel';
import { THEME_COLORS, type ReaderHandle, type ReaderLocation, type TocItem } from './types';

type Panel = 'toc' | 'settings' | null;

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
  // Chargé une seule fois : une requête "live" recréerait le fichier à chaque
  // mise à jour et rouvrirait le livre.
  const [opened, setOpened] = useState<OpenedBook | null>();
  const [settings, updateSettings] = useSettings();
  const [toc, setToc] = useState<TocItem[]>([]);
  const [location, setLocation] = useState<ReaderLocation>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<Panel>(null);
  const viewRef = useRef<ReaderHandle>(null);
  const touchStartX = useRef(0);

  const markActivity = useReadingTimer(bookId, ready && !error);

  useEffect(() => {
    let cancelled = false;
    openBook(bookId)
      .then((result) => {
        if (!cancelled) setOpened(result);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Impossible de charger ce livre.');
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const title = opened?.book.title;
  useEffect(() => {
    if (title) document.title = `${title} – Lecture`;
    return () => {
      document.title = 'Lecture';
    };
  }, [title]);

  const handleKey = useCallback(
    (key: string) => {
      markActivity();
      if (key === 'ArrowRight' || key === 'PageDown') viewRef.current?.next();
      else if (key === 'ArrowLeft' || key === 'PageUp') viewRef.current?.prev();
      else if (key === 'Escape') setPanel(null);
    },
    [markActivity],
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
      savePosition(bookId, next.position, next.percentage).catch((err) =>
        console.error('Position non enregistrée', err),
      );
    },
    [bookId, markActivity],
  );

  const onLocationsReady = useCallback(
    (locations: string) => {
      saveEpubLocations(bookId, locations).catch((err) => console.error('Repères EPUB non enregistrés', err));
    },
    [bookId],
  );

  if (opened === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p>Ce livre n’existe plus dans la bibliothèque.</p>
        <button onClick={onClose} className="rounded-lg bg-amber-600 px-4 py-2 text-white">
          Retour à la bibliothèque
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
        <button onClick={onClose} className={toolbarButton} title="Retour à la bibliothèque">
          ← Bibliothèque
        </button>
        <button
          onClick={() => setPanel(panel === 'toc' ? null : 'toc')}
          aria-pressed={panel === 'toc'}
          className={toolbarButton}
          title="Table des matières"
        >
          ☰ Sommaire
        </button>
        <h1 className="mx-2 flex-1 truncate text-center text-sm font-medium opacity-80">{title}</h1>
        <button
          onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
          aria-pressed={panel === 'settings'}
          className={toolbarButton}
          title="Réglages de lecture"
        >
          Aa Réglages
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
                settings={settings}
                initialPosition={opened.progress?.position}
                onReady={onReady}
                onLocationChange={onLocationChange}
                onError={setError}
                onKey={handleKey}
              />
            ) : (
              <EpubView
                ref={viewRef}
                file={opened.book.file}
                settings={settings}
                initialPosition={opened.progress?.position}
                onReady={onReady}
                onLocationChange={onLocationChange}
                onError={setError}
                onKey={handleKey}
                cachedLocations={opened.cachedLocations}
                onLocationsReady={onLocationsReady}
              />
            ))}
          {(!ready || error) && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: colors.background }}
            >
              <p className={error ? 'text-red-600' : 'opacity-60'}>{error ?? 'Ouverture du livre…'}</p>
            </div>
          )}
        </main>

        {ready && (
          <>
            <button
              onClick={() => viewRef.current?.prev()}
              aria-label="Page précédente"
              className="absolute left-0 top-1/2 hidden h-24 w-10 -translate-y-1/2 items-center justify-center text-2xl opacity-30 hover:opacity-80 sm:flex"
            >
              ‹
            </button>
            <button
              onClick={() => viewRef.current?.next()}
              aria-label="Page suivante"
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
                panel === 'toc' ? 'left-0 h-full w-80 max-w-[85vw] border-r' : 'right-2 mt-2 rounded-xl border'
              }`}
              style={{ background: colors.background }}
            >
              {panel === 'toc' ? (
                <TocPanel
                  toc={toc}
                  onSelect={(item) => {
                    viewRef.current?.goTo(item);
                    setPanel(null);
                  }}
                />
              ) : (
                opened && <SettingsPanel format={opened.book.format} settings={settings} onChange={updateSettings} />
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="flex h-11 shrink-0 items-center gap-4 border-t border-current/10 px-4 text-xs">
        <span className="min-w-0 flex-1 truncate opacity-70">{location?.chapter ?? ''}</span>
        {percentage !== undefined && (
          <div className="flex w-40 shrink-0 items-center gap-2" title="Avancement dans le livre">
            <ProgressBar value={percentage} className="flex-1" />
            <span className="w-9 text-right tabular-nums opacity-70">{formatPercentage(percentage)}</span>
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-right tabular-nums opacity-70">{location?.label ?? ''}</span>
      </footer>
    </div>
  );
}
