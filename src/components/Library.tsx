import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { db } from '../db/db';
import { useI18n } from '../i18n';
import { ImportError } from '../services/importErrors';
import BookCard from './BookCard';

type ImportStatus = { id: string; fileName: string; state: 'loading' | 'done' | 'error'; message?: string };
type SortKey = 'recent' | 'title' | 'author';

export default function Library() {
  const { t } = useI18n();
  const books = useLiveQuery(() => db.books.toArray(), []);
  const progressByBook = useLiveQuery(
    async () => new Map((await db.progress.toArray()).map((progress) => [progress.bookId, progress])),
    [],
  );
  const [imports, setImports] = useState<ImportStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleBooks = useMemo(() => {
    if (!books) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? books.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      : books;
    return [...filtered].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, t.locale);
      if (sort === 'author') return a.author.localeCompare(b.author, t.locale);
      return (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt);
    });
  }, [books, query, sort, t.locale]);

  function updateImport(id: string, patch: Partial<ImportStatus>) {
    setImports((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function handleFiles(files: FileList | File[]) {
    // Import un par un : le rendu des PDF est coûteux en mémoire.
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      setImports((list) => [...list, { id, fileName: file.name, state: 'loading' }]);
      try {
        // Chargé à la demande : pdf.js et epub.js (≈1 Mo) ne ralentissent pas l'ouverture de la bibliothèque.
        const { importBook } = await import('../services/importBook');
        const book = await importBook(file);
        updateImport(id, { state: 'done', message: t.library.added(book.title) });
        setTimeout(() => setImports((list) => list.filter((item) => item.id !== id)), 4000);
      } catch (error) {
        const message =
          error instanceof ImportError ? t.importErrors[error.code](error.detail) : t.library.unexpectedImportError;
        if (!(error instanceof ImportError)) console.error(error);
        updateImport(id, { state: 'error', message });
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
  }

  const fieldClass =
    'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
      className="relative min-h-[70vh]"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">
          {t.library.title} {books && books.length > 0 && <span className="text-stone-500">({books.length})</span>}
        </h2>
        <input
          type="search"
          placeholder={t.library.search}
          aria-label={t.library.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${fieldClass} w-64`}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label={t.library.sort}
          className={fieldClass}
        >
          {(Object.keys(t.library.sortOptions) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {t.library.sortOptions[key]}
            </option>
          ))}
        </select>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          {t.library.add}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {imports.length > 0 && (
        <ul className="mb-6 space-y-2" aria-live="polite">
          {imports.map((item) => (
            <li
              key={item.id}
              className={`flex items-start gap-3 rounded-lg px-4 py-2 text-sm ${
                item.state === 'error'
                  ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
                  : item.state === 'done'
                    ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
                    : 'bg-stone-100 dark:bg-stone-800'
              }`}
            >
              <span className="flex-1">
                <strong>{item.fileName}</strong> — {item.state === 'loading' ? t.library.importing : item.message}
              </span>
              {item.state === 'error' && (
                <button
                  onClick={() => setImports((list) => list.filter((i) => i.id !== item.id))}
                  aria-label={t.common.close}
                  className="opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {books && books.length === 0 && (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 py-24 text-stone-600 hover:border-amber-500 hover:text-amber-800 dark:border-stone-600 dark:text-stone-300"
        >
          <span className="text-4xl" aria-hidden>
            📚
          </span>
          <span className="font-medium">{t.library.emptyTitle}</span>
          <span className="text-sm">{t.library.emptyHint}</span>
        </button>
      )}

      {books && books.length > 0 && visibleBooks.length === 0 && (
        <p className="py-12 text-center text-stone-600 dark:text-stone-300">{t.library.noMatch(query)}</p>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleBooks.map((book) => (
          <BookCard key={book.id} book={book} progress={progressByBook?.get(book.id)} />
        ))}
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center bg-amber-500/15 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-amber-600 bg-white px-10 py-8 text-lg font-medium text-amber-800 dark:bg-stone-800 dark:text-amber-300">
            {t.library.dropHere}
          </div>
        </div>
      )}
    </div>
  );
}
