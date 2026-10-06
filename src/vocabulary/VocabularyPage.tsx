import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import WordInContext from '../components/WordInContext';
import { db, type VocabularyWord, type WordStatus } from '../db/db';
import { ROUTES } from '../routes';
import { wordsToAnkiCsv } from '../services/vocabulary/ankiExport';
import { formatInterval } from '../services/vocabulary/srs';
import { removeWord, setWordStatus } from '../services/vocabulary/vocabularyService';
import { downloadTextFile } from '../utils/download';

const STATUS_LABELS: Record<WordStatus, string> = { new: 'Nouveau', learning: 'En cours', known: 'Acquis' };
const STATUS_STYLES: Record<WordStatus, string> = {
  new: 'border-sky-400 text-sky-700 dark:text-sky-300',
  learning: 'border-amber-500 text-amber-700 dark:text-amber-300',
  known: 'border-green-500 text-green-700 dark:text-green-300',
};
const LANGUAGE_LABELS = { fr: 'Français', en: 'Anglais' };

const DAY_MS = 24 * 60 * 60 * 1000;

function nextReviewLabel(word: VocabularyWord, now: number): string {
  if (word.dueAt <= now) return 'à réviser maintenant';
  return `révision ${formatInterval(Math.max(1, Math.round((word.dueAt - now) / DAY_MS)))}`;
}

const selectClass =
  'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800';

function WordCard({ word, now }: { word: VocabularyWord; now: number }) {
  const display = word.lemma ?? word.word;
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="mr-auto">
          <p className="text-lg font-semibold">
            {display} <span className="align-middle text-xs font-normal uppercase text-stone-500">{word.language}</span>
          </p>
          {word.lemma && word.lemma.toLowerCase() !== word.word.toLowerCase() && (
            <p className="text-xs text-stone-500">rencontré sous la forme « {word.word} »</p>
          )}
        </div>
        <select
          value={word.status}
          onChange={(e) => void setWordStatus(word.id, e.target.value as WordStatus)}
          aria-label={`Statut de ${display}`}
          className={`rounded-full border bg-transparent px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[word.status]}`}
        >
          {(Object.keys(STATUS_LABELS) as WordStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (window.confirm(`Retirer « ${display} » du vocabulaire ?`)) void removeWord(word.id);
          }}
          aria-label={`Retirer ${display}`}
          title="Retirer du vocabulaire"
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
        {nextReviewLabel(word, now)}
      </p>
    </li>
  );
}

export default function VocabularyPage() {
  const words = useLiveQuery(() => db.words.orderBy('createdAt').reverse().toArray(), []);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<'all' | 'fr' | 'en'>('all');
  const [book, setBook] = useState('all');
  const [status, setStatus] = useState<'all' | WordStatus>('all');
  // Figé au premier rendu : évite que les libellés « à réviser » bougent pendant la consultation.
  const [now] = useState(() => Date.now());

  const books = useMemo(
    () => [...new Set((words ?? []).map((w) => w.bookTitle).filter((t): t is string => Boolean(t)))].sort(),
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
          w.translations.some((t) => t.toLowerCase().includes(q))),
    );
  }, [words, query, language, book, status]);

  const dueCount = (words ?? []).filter((w) => w.dueAt <= now).length;

  if (!words) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">
          Mon vocabulaire <span className="text-stone-500">({words.length})</span>
        </h2>
        <button
          onClick={() => downloadTextFile('vocabulaire-lecture.csv', wordsToAnkiCsv(visible), 'text/csv')}
          disabled={visible.length === 0}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:hover:bg-stone-800"
          title="Fichier CSV à importer dans Anki (Fichier › Importer)"
        >
          ⤓ Exporter pour Anki
        </button>
        <a
          href={ROUTES.review}
          aria-disabled={dueCount === 0}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
            dueCount === 0 ? 'pointer-events-none bg-stone-400' : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          Réviser ({dueCount})
        </a>
      </div>

      {words.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-300 px-6 py-16 text-center text-stone-500 dark:border-stone-600">
          <p className="text-4xl" aria-hidden>
            🗂️
          </p>
          <p className="mt-2 font-medium">Ton vocabulaire est vide.</p>
          <p className="mt-1 text-sm">
            Pendant la lecture, double-clique sur un mot puis choisis « ☆ Ajouter au vocabulaire ».
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Rechercher un mot ou une traduction"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${selectClass} w-64`}
            />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              aria-label="Langue"
              className={selectClass}
            >
              <option value="all">Toutes les langues</option>
              {(['fr', 'en'] as const).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABELS[l]}
                </option>
              ))}
            </select>
            <select value={book} onChange={(e) => setBook(e.target.value)} aria-label="Livre" className={selectClass}>
              <option value="all">Tous les livres</option>
              {books.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              aria-label="Statut"
              className={selectClass}
            >
              <option value="all">Tous les statuts</option>
              {(Object.keys(STATUS_LABELS) as WordStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          {visible.length === 0 ? (
            <p className="py-12 text-center text-stone-500">Aucun mot ne correspond à ces filtres.</p>
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
