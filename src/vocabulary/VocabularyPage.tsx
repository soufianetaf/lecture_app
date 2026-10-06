import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import WordInContext from '../components/WordInContext';
import { db, type VocabularyWord, type WordStatus } from '../db/db';
import { useI18n, type Messages } from '../i18n';
import { ROUTES } from '../routes';
import { wordsToAnkiCsv } from '../services/vocabulary/ankiExport';
import { removeWord, setWordStatus } from '../services/vocabulary/vocabularyService';
import { downloadTextFile } from '../utils/download';

const STATUSES: WordStatus[] = ['new', 'learning', 'known'];
const STATUS_STYLES: Record<WordStatus, string> = {
  new: 'border-sky-400 text-sky-700 dark:text-sky-300',
  learning: 'border-amber-500 text-amber-700 dark:text-amber-300',
  known: 'border-green-500 text-green-700 dark:text-green-300',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function nextReviewLabel(word: VocabularyWord, now: number, t: Messages): string {
  if (word.dueAt <= now) return t.vocabulary.dueNow;
  return t.vocabulary.nextReview(t.format.interval(Math.max(1, Math.round((word.dueAt - now) / DAY_MS))));
}

const selectClass =
  'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800';

function WordCard({ word, now }: { word: VocabularyWord; now: number }) {
  const { t } = useI18n();
  const display = word.lemma ?? word.word;
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="mr-auto">
          <p className="text-lg font-semibold">
            {display} <span className="align-middle text-xs font-normal uppercase text-stone-500">{word.language}</span>
          </p>
          {word.lemma && word.lemma.toLowerCase() !== word.word.toLowerCase() && (
            <p className="text-xs text-stone-600 dark:text-stone-300">{t.vocabulary.metAs(word.word)}</p>
          )}
        </div>
        <select
          value={word.status}
          onChange={(e) => void setWordStatus(word.id, e.target.value as WordStatus)}
          aria-label={t.vocabulary.statusOf(display)}
          className={`rounded-full border bg-transparent px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[word.status]}`}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.vocabulary.statuses[status]}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (window.confirm(t.vocabulary.confirmRemove(display))) void removeWord(word.id);
          }}
          aria-label={t.vocabulary.remove(display)}
          title={t.vocabulary.removeTitle}
          className="rounded-md px-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        >
          ✕
        </button>
      </div>

      {word.translations.length > 0 && <p className="mt-2 font-medium">{word.translations.join(', ')}</p>}
      {word.definition && (
        <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-300">{word.definition}</p>
      )}
      {word.context && (
        <blockquote className="mt-2 border-l-2 border-amber-500/60 pl-3 text-sm italic text-stone-600 dark:text-stone-300">
          <WordInContext context={word.context} word={word.word} />
        </blockquote>
      )}
      <p className="mt-2 text-xs text-stone-500">
        {word.bookTitle && <>📖 {word.bookTitle} · </>}
        {nextReviewLabel(word, now, t)}
      </p>
    </li>
  );
}

export default function VocabularyPage() {
  const { t } = useI18n();
  const words = useLiveQuery(() => db.words.orderBy('createdAt').reverse().toArray(), []);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<'all' | 'fr' | 'en'>('all');
  const [book, setBook] = useState('all');
  const [status, setStatus] = useState<'all' | WordStatus>('all');
  // Figé au premier rendu : évite que les libellés « à réviser » bougent pendant la consultation.
  const [now] = useState(() => Date.now());

  const books = useMemo(
    () => [...new Set((words ?? []).map((w) => w.bookTitle).filter((title): title is string => Boolean(title)))].sort(),
    [words],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (words ?? []).filter(
      (w) =>
        (language === 'all' || w.language === language) &&
        (book === 'all' || w.bookTitle === book) &&
        (status === 'all' || w.status === status) &&
        (!q ||
          w.word.toLowerCase().includes(q) ||
          w.lemma?.toLowerCase().includes(q) ||
          w.translations.some((translation) => translation.toLowerCase().includes(q))),
    );
  }, [words, query, language, book, status]);

  const dueCount = (words ?? []).filter((w) => w.dueAt <= now).length;

  if (!words) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">
          {t.vocabulary.title} <span className="text-stone-600 dark:text-stone-300">({words.length})</span>
        </h2>
        <button
          onClick={() => downloadTextFile(t.vocabulary.exportFile, wordsToAnkiCsv(visible), 'text/csv')}
          disabled={visible.length === 0}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:hover:bg-stone-800"
          title={t.vocabulary.exportAnkiTitle}
        >
          {t.vocabulary.exportAnki}
        </button>
        <a
          href={ROUTES.review}
          aria-disabled={dueCount === 0}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            dueCount === 0 ? 'pointer-events-none bg-stone-500' : 'bg-amber-700 hover:bg-amber-800'
          }`}
        >
          {t.vocabulary.review(dueCount)}
        </a>
      </div>

      {words.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-300 px-6 py-16 text-center text-stone-500 dark:border-stone-600">
          <p className="text-4xl" aria-hidden>
            🗂️
          </p>
          <p className="mt-2 font-medium">{t.vocabulary.empty}</p>
          <p className="mt-1 text-sm">{t.vocabulary.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="search"
              placeholder={t.vocabulary.search}
              aria-label={t.vocabulary.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${selectClass} w-64`}
            />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              aria-label={t.vocabulary.language}
              className={selectClass}
            >
              <option value="all">{t.vocabulary.allLanguages}</option>
              {(['fr', 'en'] as const).map((l) => (
                <option key={l} value={l}>
                  {t.common.languages[l]}
                </option>
              ))}
            </select>
            <select
              value={book}
              onChange={(e) => setBook(e.target.value)}
              aria-label={t.vocabulary.book}
              className={selectClass}
            >
              <option value="all">{t.vocabulary.allBooks}</option>
              {books.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              aria-label={t.vocabulary.status}
              className={selectClass}
            >
              <option value="all">{t.vocabulary.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.vocabulary.statuses[s]}
                </option>
              ))}
            </select>
          </div>
          {visible.length === 0 ? (
            <p className="py-12 text-center text-stone-600 dark:text-stone-300">{t.vocabulary.noMatch}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visible.map((word) => (
                <WordCard key={word.id} word={word} now={now} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
