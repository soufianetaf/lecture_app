import { useState, type ReactNode } from 'react';
import type { BookLanguage } from '../db/db';
import { useAsync, type AsyncState } from '../hooks/useAsync';
import { useI18n } from '../i18n';
import { LookupError } from '../services/dictionary/errors';
import {
  lookupDefinition,
  lookupTranslation,
  MAX_TEXT_LENGTH,
  translateText,
} from '../services/dictionary/lookupService';
import type { DefinitionResult, LookupLanguage, Source } from '../services/dictionary/types';
import SaveWordButton from './SaveWordButton';

/** Ce que le lecteur a demandé : un mot à définir ou un passage à traduire. */
export type LookupQuery = { kind: 'word'; word: string; context?: string } | { kind: 'text'; text: string };

const MAX_SENSES = 3;
const MAX_DEFINITIONS_PER_SENSE = 3;

const other = (language: LookupLanguage): LookupLanguage => (language === 'fr' ? 'en' : 'fr');

function SourceLink({ source }: { source: Source }) {
  const { t } = useI18n();
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="text-[11px] underline opacity-60 hover:opacity-100"
    >
      {t.dictionary.source(source.name)}
      {source.license && ` (${source.license})`}
    </a>
  );
}

/** Affiche chargement, erreur (avec « Réessayer »), introuvable ou contenu. */
function AsyncSection<T>({
  title,
  state,
  notFound,
  onRetry,
  children,
}: {
  title: string;
  state: AsyncState<T | null>;
  notFound: string;
  onRetry(): void;
  children(data: T): ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="border-t border-current/10 px-4 py-3" aria-busy={state.status === 'loading'}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">{title}</h3>
      {state.status === 'loading' && (
        <div className="space-y-2" role="status" aria-label={t.common.loading}>
          <div className="h-3 w-3/4 animate-pulse rounded bg-current/10" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-current/10" />
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" className="text-sm">
          <p className="text-red-600">
            {state.error instanceof LookupError ? t.dictionary.errors[state.error.kind] : t.dictionary.unexpectedError}
          </p>
          <button onClick={onRetry} className="mt-1 text-xs underline">
            {t.common.retry}
          </button>
        </div>
      )}
      {state.status === 'success' &&
        (state.data === null ? <p className="text-sm opacity-70">{notFound}</p> : children(state.data))}
    </section>
  );
}

function Definitions({ result }: { result: DefinitionResult }) {
  return (
    <div className="space-y-3">
      {result.entry.senses.slice(0, MAX_SENSES).map((sense, i) => (
        <div key={i}>
          <p className="text-xs font-medium italic opacity-70">{sense.partOfSpeech}</p>
          <ol className="ml-4 list-decimal space-y-1.5 text-sm">
            {sense.definitions.slice(0, MAX_DEFINITIONS_PER_SENSE).map((definition, j) => (
              <li key={j}>
                {definition.text}
                {definition.example && (
                  <span className="mt-0.5 block text-xs italic opacity-70">
                    « {definition.example} »
                    {definition.exampleTranslation && (
                      <span className="block not-italic">→ {definition.exampleTranslation}</span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <SourceLink source={result.source} />
    </div>
  );
}

function WordLookup({
  word,
  language,
  context,
  book,
}: {
  word: string;
  language: LookupLanguage;
  context?: string;
  book: { id: string; title: string };
}) {
  const { t } = useI18n();
  const [retry, setRetry] = useState(0);
  const target = other(language);
  const definition = useAsync(() => lookupDefinition(word, language), `def:${language}:${word}:${retry}`);
  const translation = useAsync(() => lookupTranslation(word, language, target), `tr:${language}:${word}:${retry}`);
  const entry = definition.status === 'success' ? definition.data : null;

  return (
    <>
      <div className="px-4 pb-3">
        <p className="text-2xl font-semibold">{word}</p>
        {entry?.lemma && (
          <p className="text-sm opacity-70">
            {t.dictionary.formOf} <strong>{entry.lemma}</strong>
          </p>
        )}
        {entry?.entry.pronunciation && (
          <div className="mt-1 flex items-center gap-2 text-sm opacity-80">
            <span>/{entry.entry.pronunciation}/</span>
            {entry.entry.audioUrl && <AudioButton url={entry.entry.audioUrl} />}
          </div>
        )}
        <SaveWordButton
          word={word}
          language={language}
          context={context}
          book={book}
          definition={definition}
          translation={translation}
        />
      </div>
      <AsyncSection
        title={t.dictionary.definition(t.common.languagesInline[language])}
        state={definition}
        notFound={t.dictionary.noDefinition(word)}
        onRetry={() => setRetry((n) => n + 1)}
      >
        {(result) => <Definitions result={result} />}
      </AsyncSection>
      <AsyncSection
        title={t.dictionary.translation(t.common.languagesInline[target])}
        state={translation}
        notFound={t.dictionary.noTranslation}
        onRetry={() => setRetry((n) => n + 1)}
      >
        {(result) => (
          <div className="space-y-3">
            {result.groups.map((group) => (
              <div key={group.lemma ?? word} className="space-y-1.5">
                {/* Libellé seulement s'il y a une forme de base ou plusieurs groupes. */}
                {(group.lemma || result.groups.length > 1) && (
                  <p className="text-xs opacity-70">
                    {group.lemma ? (
                      <>
                        {t.dictionary.formOf} <strong>{group.lemma}</strong>
                      </>
                    ) : (
                      <>
                        <strong>{word}</strong> {t.dictionary.otherSenses}
                      </>
                    )}
                  </p>
                )}
                <ul className="flex flex-wrap gap-1.5">
                  {group.translations.map((gloss) => (
                    <li key={gloss} className="rounded-full bg-amber-600/15 px-2.5 py-1 text-sm">
                      {gloss}
                    </li>
                  ))}
                </ul>
                <SourceLink source={group.source} />
              </div>
            ))}
          </div>
        )}
      </AsyncSection>
    </>
  );
}

function TextLookup({ text, language }: { text: string; language: LookupLanguage }) {
  const { t } = useI18n();
  const [retry, setRetry] = useState(0);
  const target = other(language);
  const translation = useAsync(() => translateText(text, language, target), `txt:${language}:${text}:${retry}`);
  return (
    <>
      <blockquote className="mx-4 mb-3 border-l-2 border-current/20 pl-3 text-sm italic opacity-80">
        {text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text}
      </blockquote>
      {text.length > MAX_TEXT_LENGTH && (
        <p className="mx-4 mb-2 text-xs opacity-70">{t.dictionary.truncated(MAX_TEXT_LENGTH)}</p>
      )}
      <AsyncSection
        title={t.dictionary.translation(t.common.languagesInline[target])}
        state={translation}
        notFound={t.dictionary.noTranslation}
        onRetry={() => setRetry((n) => n + 1)}
      >
        {(result) => (
          <div className="space-y-2">
            <p className="text-sm">{result.translation}</p>
            <SourceLink source={result.source} />
          </div>
        )}
      </AsyncSection>
    </>
  );
}

function AudioButton({ url }: { url: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  return (
    <button
      onClick={() => {
        new Audio(url).play().catch(() => setFailed(true));
      }}
      disabled={failed}
      title={failed ? t.dictionary.audioUnavailable : t.dictionary.listen}
      aria-label={t.dictionary.listen}
      className="rounded-full px-1.5 hover:bg-current/10 disabled:opacity-40"
    >
      🔊
    </button>
  );
}

interface Props {
  query: LookupQuery;
  language: BookLanguage;
  /** Livre d'où vient le mot, enregistré avec lui dans le vocabulaire. */
  book: { id: string; title: string };
  onLanguageChange(language: LookupLanguage): void;
  onClose(): void;
}

/** Panneau latéral (ou en bas sur mobile) : définition et traduction. */
export default function WordPanel({ query, language, book, onLanguageChange, onClose }: Props) {
  const { t } = useI18n();
  return (
    <aside
      aria-label={query.kind === 'word' ? t.dictionary.wordPanel : t.dictionary.textPanel}
      className="flex flex-col overflow-y-auto"
    >
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-60">
          {query.kind === 'word' ? t.dictionary.title : t.dictionary.textTitle}
        </h2>
        <button onClick={onClose} aria-label={t.dictionary.close} className="rounded-md px-2 py-1 hover:bg-current/10">
          ✕
        </button>
      </div>

      {language === 'unknown' ? (
        <div className="px-4 py-3 text-sm">
          <p className="mb-2">{t.dictionary.askLanguage}</p>
          <div className="flex gap-2">
            {(['fr', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className="rounded-md border border-current/20 px-3 py-1.5 hover:bg-current/10"
              >
                {t.common.languages[lang]}
              </button>
            ))}
          </div>
        </div>
      ) : query.kind === 'word' ? (
        <WordLookup key={query.word} word={query.word} language={language} context={query.context} book={book} />
      ) : (
        <TextLookup key={query.text} text={query.text} language={language} />
      )}
    </aside>
  );
}
