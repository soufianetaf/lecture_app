import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import WordInContext from '../components/WordInContext';
import { db, type VocabularyWord } from '../db/db';
import { ROUTES } from '../routes';
import { advanceQueue, SESSION_SIZE } from '../services/vocabulary/session';
import { formatInterval, schedule, type Grade } from '../services/vocabulary/srs';
import { getDueWords, recordReview } from '../services/vocabulary/vocabularyService';

const GRADES: { value: Grade; label: string; key: string; style: string }[] = [
  { value: 'again', label: 'À revoir', key: '1', style: 'bg-red-600 hover:bg-red-700' },
  { value: 'hard', label: 'Difficile', key: '2', style: 'bg-orange-500 hover:bg-orange-600' },
  { value: 'good', label: 'Bien', key: '3', style: 'bg-green-600 hover:bg-green-700' },
  { value: 'easy', label: 'Facile', key: '4', style: 'bg-sky-600 hover:bg-sky-700' },
];

function Card({ word, revealed }: { word: VocabularyWord; revealed: boolean }) {
  const display = word.lemma ?? word.word;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-700 dark:bg-stone-800">
      <p className="text-xs uppercase tracking-wide text-stone-500">
        {word.language === 'fr' ? 'Français' : 'Anglais'}
      </p>
      <p className="mt-2 text-4xl font-semibold">{display}</p>
      {word.context && (
        <p className="mx-auto mt-4 max-w-lg text-sm italic text-stone-600 dark:text-stone-300">
          « <WordInContext context={word.context} word={word.word} /> »
        </p>
      )}
      {revealed && (
        <div className="mt-6 border-t border-stone-200 pt-6 dark:border-stone-700">
          {word.translations.length > 0 && <p className="text-xl font-medium">{word.translations.join(', ')}</p>}
          {word.definition && (
            <p className="mx-auto mt-2 max-w-lg text-sm text-stone-600 dark:text-stone-300">{word.definition}</p>
          )}
          {word.translations.length === 0 && !word.definition && (
            <p className="text-sm text-stone-500">Pas de traduction enregistrée.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SessionDone({ reviewed, forgotten, now }: { reviewed: number; forgotten: number; now: number }) {
  // Prochain mot à réviser, pour dire quand revenir.
  const next = useLiveQuery(() => db.words.orderBy('dueAt').first(), []);
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-800">
      <p className="text-4xl" aria-hidden>
        {reviewed > 0 ? '🎉' : '✅'}
      </p>
      <p className="mt-2 text-lg font-semibold">
        {reviewed > 0 ? 'Séance terminée !' : 'Rien à réviser pour le moment.'}
      </p>
      {reviewed > 0 && (
        <p className="mt-1 text-stone-600 dark:text-stone-300">
          {reviewed} réponse{reviewed > 1 ? 's' : ''}, dont {forgotten} mot{forgotten > 1 ? 's' : ''} à revoir.
        </p>
      )}
      {next && next.dueAt > now && (
        <p className="mt-1 text-sm text-stone-500">
          Prochaine révision le{' '}
          {new Date(next.dueAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.
        </p>
      )}
      <a
        href={ROUTES.vocabulary}
        className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700"
      >
        Retour au vocabulaire
      </a>
    </div>
  );
}

export default function ReviewPage() {
  // File figée en début de séance : les mots ajoutés pendant la séance attendront la prochaine.
  const [queue, setQueue] = useState<VocabularyWord[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, forgotten: 0 });
  // Heure de référence, figée entre deux réponses (aperçus d’intervalle stables).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    getDueWords(Date.now(), SESSION_SIZE)
      .then((words) => {
        if (!cancelled) setQueue(words);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue?.[0];

  const answer = useCallback(
    async (grade: Grade) => {
      if (!current || busy) return;
      setBusy(true);
      setError(false);
      try {
        const updated = (await recordReview(current.id, grade)) ?? current;
        setQueue((q) => (q ? advanceQueue(q, updated, grade) : q));
        setStats((s) => ({ reviewed: s.reviewed + 1, forgotten: s.forgotten + (grade === 'again' ? 1 : 0) }));
        setRevealed(false);
        setNow(Date.now());
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setBusy(false);
      }
    },
    [current, busy],
  );

  // Clavier : Espace ou Entrée pour retourner la carte, 1 à 4 pour répondre.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current) return;
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      const grade = GRADES.find((g) => g.key === event.key);
      if (revealed && grade) void answer(grade.value);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, revealed, answer]);

  if (queue === null) return error ? <p className="text-red-600">Impossible de charger les mots à réviser.</p> : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-sm text-stone-500">
        <a href={ROUTES.vocabulary} className="hover:underline">
          ← Vocabulaire
        </a>
        {current && (
          <span>
            {queue.length} carte{queue.length > 1 ? 's' : ''} restante{queue.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!current ? (
        <SessionDone {...stats} now={now} />
      ) : (
        <>
          <Card word={current} revealed={revealed} />
          <div className="mt-6">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-xl bg-stone-800 py-3 text-white hover:bg-stone-900 dark:bg-stone-200 dark:text-stone-900"
              >
                Afficher la réponse <span className="text-xs opacity-60">(Espace)</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Ta réponse">
                {GRADES.map((grade) => (
                  <button
                    key={grade.value}
                    onClick={() => void answer(grade.value)}
                    disabled={busy}
                    className={`rounded-xl px-3 py-2 text-white disabled:opacity-50 ${grade.style}`}
                  >
                    <span className="block font-medium">{grade.label}</span>
                    <span className="block text-xs opacity-80">
                      {formatInterval(schedule(current, grade.value, now).intervalDays)} · {grade.key}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                La réponse n’a pas été enregistrée. Réessaie.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
