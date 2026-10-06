import { useEffect, useRef } from 'react';
import { db, type Book, type BookLanguage, type Progress } from '../db/db';
import { useI18n, type Messages } from '../i18n';
import { ROUTES } from '../routes';
import { deleteBook } from '../services/bookService';
import { isFinished } from '../services/progress';
import ProgressBar from './ProgressBar';

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

function progressLabel(progress: Progress | undefined, t: Messages): string {
  if (!progress?.position) return t.book.notStarted;
  const status = isFinished(progress.percentage) ? t.book.finished : t.format.percentage(progress.percentage);
  return progress.totalReadingMs > 0 ? `${status} · ${t.format.duration(progress.totalReadingMs)}` : status;
}

export default function BookCard({ book, progress }: { book: Book; progress?: Progress }) {
  const { t } = useI18n();
  const author = book.author.trim() || t.common.unknownAuthor;

  async function remove() {
    if (!window.confirm(t.book.confirmDelete(book.title))) return;
    try {
      await deleteBook(book.id);
    } catch (error) {
      console.error(error);
      window.alert(t.book.deleteFailed);
    }
  }

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-stone-200 shadow-sm ring-1 ring-stone-900/5 transition group-hover:shadow-md dark:bg-stone-700">
        <a href={ROUTES.reader(book.id)} aria-label={t.book.read(book.title)} className="block h-full">
          {book.cover ? (
            <BlobImage blob={book.cover} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col justify-between bg-gradient-to-br from-amber-700 to-stone-800 p-4 text-white">
              <span className="line-clamp-5 font-serif text-lg leading-snug">{book.title}</span>
              <span className="text-xs opacity-90">{author}</span>
            </div>
          )}
        </a>
        <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {book.format}
        </span>
        <button
          onClick={remove}
          aria-label={t.book.deleteLabel(book.title)}
          title={t.common.delete}
          className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-sm text-white opacity-0 transition hover:bg-red-600 focus:opacity-100 group-hover:opacity-100"
        >
          ✕
        </button>
        {progress?.position && (
          <ProgressBar
            value={progress.percentage}
            label={t.reader.progress}
            className="absolute inset-x-0 bottom-0 h-1.5 rounded-none bg-black/30 text-white"
          />
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-tight" title={book.title}>
        <a href={ROUTES.reader(book.id)} className="hover:underline">
          {book.title}
        </a>
      </h3>
      <div className="mt-1 flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
        <span className="line-clamp-1 flex-1" title={author}>
          {author}
        </span>
        <select
          value={book.language}
          onChange={(e) => db.books.update(book.id, { language: e.target.value as BookLanguage })}
          aria-label={`${t.book.language} : ${book.title}`}
          title={t.book.language}
          className={`rounded border px-1 py-0.5 text-[11px] font-semibold dark:bg-stone-800 ${
            book.language === 'unknown' ? 'border-red-400 text-red-700' : 'border-stone-300 dark:border-stone-600'
          }`}
        >
          {(Object.keys(t.book.languageShort) as BookLanguage[]).map((lang) => (
            <option key={lang} value={lang}>
              {t.book.languageShort[lang]}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-300">{progressLabel(progress, t)}</p>
    </article>
  );
}
