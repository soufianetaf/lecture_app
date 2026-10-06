import { useEffect, useRef } from 'react';
import { db, type Book, type BookLanguage, type Progress } from '../db/db';
import { deleteBook } from '../services/bookService';
import { displayAuthor } from '../services/errorMessages';
import { formatDuration, formatPercentage, isFinished } from '../services/progress';
import { ROUTES } from '../routes';
import ProgressBar from './ProgressBar';

const LANGUAGE_LABELS: Record<BookLanguage, string> = { fr: 'FR', en: 'EN', unknown: '?' };

/** Image affichée depuis un Blob : l'URL temporaire est libérée au démontage. */
function BlobImage({ blob, className }: { blob: Blob; className?: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    imgRef.current!.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return <img ref={imgRef} alt="" className={className} />;
}

function progressLabel(progress: Progress | undefined): string {
  if (!progress?.position) return 'Non commencé';
  const status = isFinished(progress.percentage) ? 'Terminé' : formatPercentage(progress.percentage);
  return progress.totalReadingMs > 0 ? `${status} · ${formatDuration(progress.totalReadingMs)}` : status;
}

export default function BookCard({ book, progress }: { book: Book; progress?: Progress }) {
  async function remove() {
    if (!window.confirm(`Supprimer « ${book.title} » de la bibliothèque ? Sa progression sera aussi effacée.`)) return;
    try {
      await deleteBook(book.id);
    } catch (error) {
      console.error(error);
      window.alert('La suppression a échoué. Réessaie.');
    }
  }

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-stone-200 shadow-sm ring-1 ring-stone-900/5 transition group-hover:shadow-md dark:bg-stone-700">
        <a href={ROUTES.reader(book.id)} aria-label={`Lire ${book.title}`} className="block h-full">
          {book.cover ? (
            <BlobImage blob={book.cover} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col justify-between bg-gradient-to-br from-amber-700 to-stone-800 p-4 text-white">
              <span className="line-clamp-5 font-serif text-lg leading-snug">{book.title}</span>
              <span className="text-xs opacity-80">{displayAuthor(book.author)}</span>
            </div>
          )}
        </a>
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {book.format}
        </span>
        <button
          onClick={remove}
          aria-label={`Supprimer ${book.title}`}
          title="Supprimer"
          className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-sm text-white opacity-0 transition hover:bg-red-600 focus:opacity-100 group-hover:opacity-100"
        >
          ✕
        </button>
        {progress?.position && (
          <ProgressBar
            value={progress.percentage}
            className="absolute inset-x-0 bottom-0 h-1.5 rounded-none bg-black/30 text-white"
          />
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-tight" title={book.title}>
        <a href={ROUTES.reader(book.id)} className="hover:underline">
          {book.title}
        </a>
      </h3>
      <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
        <span className="line-clamp-1 flex-1" title={displayAuthor(book.author)}>
          {displayAuthor(book.author)}
        </span>
        <select
          value={book.language}
          onChange={(e) => db.books.update(book.id, { language: e.target.value as BookLanguage })}
          aria-label="Langue du livre"
          title="Langue du livre"
          className={`rounded border px-1 py-0.5 text-[11px] font-semibold dark:bg-stone-800 ${
            book.language === 'unknown' ? 'border-red-400 text-red-600' : 'border-stone-300 dark:border-stone-600'
          }`}
        >
          {(Object.keys(LANGUAGE_LABELS) as BookLanguage[]).map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang]}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-0.5 text-xs text-stone-500">{progressLabel(progress)}</p>
    </article>
  );
}
