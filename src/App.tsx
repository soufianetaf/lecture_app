import { useEffect, useState } from 'react';
import Library from './components/Library';
import Reader from './reader/Reader';

/** Livre ouvert d'après l'adresse (#/livre/<id>), pour survivre au rechargement. */
function bookIdFromHash(): string | null {
  const match = window.location.hash.match(/^#\/livre\/([\w-]+)$/);
  return match ? match[1] : null;
}

export default function App() {
  const [bookId, setBookId] = useState(bookIdFromHash);

  useEffect(() => {
    const onHashChange = () => setBookId(bookIdFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (bookId) {
    return <Reader key={bookId} bookId={bookId} onClose={() => (window.location.hash = '')} />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur dark:border-stone-700 dark:bg-stone-800/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="text-2xl" aria-hidden>
            📖
          </span>
          <h1 className="text-xl font-semibold">Lecture</h1>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Library />
      </main>
    </div>
  );
}
