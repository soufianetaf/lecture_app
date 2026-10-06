import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Library from './components/Library';
import { db } from './db/db';
import { parseRoute, ROUTES, type Route } from './routes';

// Écrans chargés à la demande : la bibliothèque s'affiche sans attendre
// pdf.js et epub.js, utilisés seulement par le lecteur.
const Reader = lazy(() => import('./reader/Reader'));
const VocabularyPage = lazy(() => import('./vocabulary/VocabularyPage'));
const ReviewPage = lazy(() => import('./vocabulary/ReviewPage'));
const SettingsPage = lazy(() => import('./settings/SettingsPage'));

function Loading() {
  return (
    <p role="status" className="p-8 text-center text-stone-500">
      Chargement…
    </p>
  );
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className="rounded-lg px-3 py-1.5 text-sm hover:bg-stone-100 aria-[current=page]:bg-stone-200 aria-[current=page]:font-medium dark:hover:bg-stone-700 dark:aria-[current=page]:bg-stone-700"
    >
      {children}
    </a>
  );
}

export default function App() {
  const route = useRoute();
  // Mots à réviser, pour le badge de navigation (mis à jour à chaque changement du vocabulaire).
  const dueCount = useLiveQuery(() => db.words.where('dueAt').belowOrEqual(Date.now()).count(), []);

  if (route.name === 'reader') {
    return (
      <ErrorBoundary resetKey={route.bookId} message="Le lecteur a rencontré un problème.">
        <Suspense fallback={<Loading />}>
          <Reader key={route.bookId} bookId={route.bookId} onClose={() => (window.location.hash = ROUTES.library)} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur dark:border-stone-700 dark:bg-stone-800/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <a href={ROUTES.library} className="mr-4 flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              📖
            </span>
            <h1 className="text-xl font-semibold">Lecture</h1>
          </a>
          <nav aria-label="Navigation principale" className="flex gap-1">
            <NavLink href={ROUTES.library} active={route.name === 'library'}>
              Bibliothèque
            </NavLink>
            <NavLink href={ROUTES.vocabulary} active={route.name === 'vocabulary'}>
              Vocabulaire
            </NavLink>
            <NavLink href={ROUTES.review} active={route.name === 'review'}>
              Révision
              {dueCount !== undefined && dueCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-600 px-1.5 py-0.5 text-xs text-white">{dueCount}</span>
              )}
            </NavLink>
            <NavLink href={ROUTES.settings} active={route.name === 'settings'}>
              Paramètres
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <ErrorBoundary resetKey={route.name}>
          <Suspense fallback={<Loading />}>
            {route.name === 'library' && <Library />}
            {route.name === 'vocabulary' && <VocabularyPage />}
            {route.name === 'review' && <ReviewPage />}
            {route.name === 'settings' && <SettingsPage />}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
