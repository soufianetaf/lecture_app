import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { AsyncState } from '../hooks/useAsync';
import type { DefinitionResult, LookupLanguage, TranslationResult } from '../services/dictionary/types';
import { findWord, removeWord, saveWord, wordKey } from '../services/vocabulary/vocabularyService';

/** Nombre de traductions gardées avec un mot du vocabulaire. */
const MAX_SAVED_TRANSLATIONS = 4;

interface Props {
  word: string;
  language: LookupLanguage;
  context?: string;
  book: { id: string; title: string };
  definition: AsyncState<DefinitionResult | null>;
  translation: AsyncState<TranslationResult | null>;
}

function firstDefinition(result: DefinitionResult | null): string | undefined {
  for (const sense of result?.entry.senses ?? []) {
    const definition = sense.definitions.find((d) => !d.isFormOf);
    if (definition) return definition.text;
  }
  return undefined;
}

function savedTranslations(result: TranslationResult | null): string[] {
  const all = result?.groups.flatMap((group) => group.translations) ?? [];
  return [...new Set(all)].slice(0, MAX_SAVED_TRANSLATIONS);
}

/** « Ajouter au vocabulaire » / « Dans ton vocabulaire » (cliquer à nouveau retire le mot). */
export default function SaveWordButton({ word, language, context, book, definition, translation }: Props) {
  const [error, setError] = useState(false);
  const definitionData = definition.status === 'success' ? definition.data : null;
  const lemma = definitionData?.lemma;
  const key = wordKey(word, lemma);
  // Requête "live" : le bouton reflète aussi un ajout fait ailleurs.
  const saved = useLiveQuery(() => findWord(language, key), [language, key]);
  // On attend la définition pour enregistrer la bonne forme de base.
  const pending = definition.status === 'loading';

  async function toggle() {
    setError(false);
    try {
      if (saved) {
        await removeWord(saved.id);
        return;
      }
      await saveWord({
        language,
        word,
        lemma,
        translations: savedTranslations(translation.status === 'success' ? translation.data : null),
        definition: firstDefinition(definitionData),
        context,
        bookId: book.id,
        bookTitle: book.title,
      });
    } catch (err) {
      console.error('Vocabulaire non mis à jour', err);
      setError(true);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={Boolean(saved)}
        title={saved ? 'Retirer du vocabulaire' : 'Ajouter au vocabulaire'}
        className={`rounded-full border px-3 py-1 text-sm transition disabled:opacity-40 ${
          saved
            ? 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700'
            : 'border-current/25 hover:bg-current/10'
        }`}
      >
        {saved ? '★ Dans ton vocabulaire' : '☆ Ajouter au vocabulaire'}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          L’enregistrement a échoué. Réessaie.
        </p>
      )}
    </div>
  );
}
