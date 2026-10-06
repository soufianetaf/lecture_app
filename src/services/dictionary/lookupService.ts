// Recherche de définitions et de traductions.
//
// Deux Wiktionnaires utilisés de façon symétrique :
//   - en.wiktionary : définitions des mots anglais (en anglais) et gloses anglaises des mots français ;
//   - fr.wiktionary : définitions des mots français (en français) et gloses françaises des mots anglais.
// La définition vient du Wiktionnaire de la langue du livre, la traduction de
// l'autre. MyMemory sert de secours pour les mots et traduit les phrases.

import { cached } from './cache';
import { parseEnWiktionary, type RestDefinitionResponse } from './enWiktionary';
import { fetchJson } from './http';
import { parseMyMemory, type MyMemoryResponse } from './myMemory';
import type {
  DefinitionResult,
  DictionaryEntry,
  LookupLanguage,
  Source,
  TextTranslationResult,
  TranslationGroup,
  TranslationResult,
} from './types';
import { parseFrWiktionary } from './wikitext';
import { englishLemmaCandidates, frenchLemmaCandidates, spellingVariants } from './words';

/** Longueur maximale acceptée par MyMemory pour une requête. */
export const MAX_TEXT_LENGTH = 500;

const MAX_TRANSLATIONS = 6;
/** Par groupe, quand le mot et sa forme de base sont tous deux traduits. */
const MAX_BASE_TRANSLATIONS = 4;
const MAX_TRANSLATION_LENGTH = 80;

const WIKTIONARY_LICENSE = 'CC BY-SA 4.0';

function wiktionarySource(site: LookupLanguage, title: string): Source {
  return {
    name: site === 'fr' ? 'Wiktionnaire' : 'Wiktionary',
    url: `https://${site}.wiktionary.org/wiki/${encodeURIComponent(title)}`,
    license: WIKTIONARY_LICENSE,
  };
}

const MYMEMORY_SOURCE: Source = { name: 'MyMemory', url: 'https://mymemory.translated.net/' };

/** Entrée de `language` pour la page `title` du Wiktionnaire `site`. */
async function fetchEntry(
  site: LookupLanguage,
  title: string,
  language: LookupLanguage,
): Promise<DictionaryEntry | null> {
  if (site === 'en') {
    const response = await fetchJson<RestDefinitionResponse>(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(title)}`,
    );
    return response ? parseEnWiktionary(response, language) : null;
  }
  const response = await fetchJson<{ parse?: { wikitext?: string }; error?: { code: string } }>(
    `https://fr.wiktionary.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&origin=*&page=${encodeURIComponent(title)}`,
  );
  const wikitext = response?.parse?.wikitext;
  return wikitext ? parseFrWiktionary(wikitext, language) : null;
}

/** Première orthographe connue du mot (minuscules, casse d'origine, apostrophes). */
async function findEntry(
  site: LookupLanguage,
  word: string,
  language: LookupLanguage,
): Promise<{ title: string; entry: DictionaryEntry } | null> {
  for (const title of spellingVariants(word)) {
    const entry = await fetchEntry(site, title, language);
    if (entry) return { title, entry };
  }
  return null;
}

function ruleLemmaCandidates(word: string, language: LookupLanguage): string[] {
  return language === 'en' ? englishLemmaCandidates(word) : frenchLemmaCandidates(word);
}

/**
 * Définition d'un mot dans la langue du livre. Une forme fléchie (« ran »)
 * est remplacée par sa forme de base (« run »), signalée dans `lemma`.
 */
export function lookupDefinition(word: string, language: LookupLanguage): Promise<DefinitionResult | null> {
  return cached(`def:${language}:${word}`, async () => {
    const site = language;
    let found = await findEntry(site, word, language);
    // Mot inconnu tel quel : essai des formes de base devinées par règles.
    for (const candidate of found ? [] : ruleLemmaCandidates(word, language)) {
      found = await findEntry(site, candidate, language);
      if (found) break;
    }
    if (!found) return null;

    let { title, entry } = found;
    if (entry.onlyForms && entry.lemma) {
      const base = await fetchEntry(site, entry.lemma, language);
      if (base) {
        title = entry.lemma;
        // On garde la prononciation du mot lu, pas celle de sa forme de base.
        entry = {
          ...base,
          pronunciation: entry.pronunciation ?? base.pronunciation,
          audioUrl: entry.audioUrl ?? base.audioUrl,
        };
      }
    }
    const lemma = title.toLowerCase() !== word.toLowerCase() ? title : undefined;
    return { word, lemma, entry, source: wiktionarySource(site, title) };
  });
}

/** Nature du mot comparable entre sources : « Verbe », « Verb », « Participle » → « verb ». */
function normalizePartOfSpeech(partOfSpeech: string): string {
  const pos = partOfSpeech.toLowerCase();
  if (pos.startsWith('verb') || pos.startsWith('particip')) return 'verb';
  if (pos.startsWith('nom') || pos.startsWith('noun')) return 'noun';
  if (pos.startsWith('adj')) return 'adjective';
  return pos;
}

/**
 * Gloses d'une entrée transformées en traductions courtes et sans doublons.
 * Les sens de la nature `preferredPartOfSpeech` passent en premier.
 */
export function glossesToTranslations(entry: DictionaryEntry, preferredPartOfSpeech?: string): string[] {
  const preferred = preferredPartOfSpeech && normalizePartOfSpeech(preferredPartOfSpeech);
  const senses = preferred
    ? [...entry.senses].sort(
        (a, b) =>
          Number(normalizePartOfSpeech(b.partOfSpeech) === preferred) -
          Number(normalizePartOfSpeech(a.partOfSpeech) === preferred),
      )
    : entry.senses;
  const seen = new Set<string>();
  const translations: string[] = [];
  for (const sense of senses) {
    for (const definition of sense.definitions) {
      if (definition.isFormOf) continue;
      // Première phrase seulement : « Maison (famille). Note d'usage… » → « Maison (famille) ».
      const short = definition.text
        .split(/(?<=\.)\s|;/)[0]
        .replace(/\.$/, '')
        .trim();
      const key = short.toLowerCase();
      if (!short || short.length > MAX_TRANSLATION_LENGTH || seen.has(key)) continue;
      seen.add(key);
      translations.push(short);
      if (translations.length === MAX_TRANSLATIONS) return translations;
    }
  }
  return translations;
}

/**
 * Premier renvoi vers une forme de base (« ran » → « run »), avec la nature du
 * mot concernée, pour traduire en priorité les sens de même nature.
 */
function formOfTarget(entry: DictionaryEntry): { lemma: string; partOfSpeech: string } | undefined {
  for (const sense of entry.senses) {
    for (const definition of sense.definitions) {
      if (definition.isFormOf && definition.formOf)
        return { lemma: definition.formOf, partOfSpeech: sense.partOfSpeech };
    }
  }
  return undefined;
}

async function myMemory(text: string, from: LookupLanguage, to: LookupLanguage): Promise<string | null> {
  const response = await fetchJson<MyMemoryResponse>(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`,
  );
  return response ? parseMyMemory(response) : null;
}

/** Traductions d'un mot, depuis le Wiktionnaire de la langue cible, sinon MyMemory. */
export function lookupTranslation(
  word: string,
  from: LookupLanguage,
  to: LookupLanguage,
): Promise<TranslationResult | null> {
  return cached(`tr:${from}>${to}:${word}`, async () => {
    // La page du mot dans le Wiktionnaire de la langue cible donne ses gloses.
    const site = to;
    const queue = [word, ...ruleLemmaCandidates(word, from)];
    const tried = new Set<string>();
    while (queue.length > 0) {
      const candidate = queue.shift()!;
      if (tried.has(candidate)) continue;
      tried.add(candidate);
      const found = await findEntry(site, candidate, from);
      if (!found) continue;

      const groups: TranslationGroup[] = [];
      // Mot fléchi (« ran » = prétérit de « run ») : la forme de base d'abord,
      // en privilégiant les sens de même nature (verbe → verbe).
      const target = formOfTarget(found.entry);
      if (target && !tried.has(target.lemma)) {
        tried.add(target.lemma);
        const base = await findEntry(site, target.lemma, from);
        const translations = base ? glossesToTranslations(base.entry, target.partOfSpeech) : [];
        if (base && translations.length > 0) {
          groups.push({
            lemma: target.lemma,
            translations: translations.slice(0, MAX_BASE_TRANSLATIONS),
            source: wiktionarySource(site, base.title),
          });
        }
      }
      // Puis les sens propres du mot (« striking » : frappant, remarquable).
      const own = glossesToTranslations(found.entry);
      if (own.length > 0) {
        groups.push({
          // Trouvé par une forme de base devinée (« runs » → « run ») : on l'indique.
          lemma: candidate.toLowerCase() !== word.toLowerCase() ? candidate : undefined,
          translations: own.slice(0, groups.length > 0 ? MAX_BASE_TRANSLATIONS : MAX_TRANSLATIONS),
          source: wiktionarySource(site, found.title),
        });
      }
      if (groups.length > 0) return { word, groups };
    }

    const translation = await myMemory(word, from, to);
    return translation ? { word, groups: [{ translations: [translation], source: MYMEMORY_SOURCE }] } : null;
  });
}

/** Traduction d'une phrase ou d'un passage (MyMemory). */
export function translateText(
  text: string,
  from: LookupLanguage,
  to: LookupLanguage,
): Promise<TextTranslationResult | null> {
  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  return cached(`txt:${from}>${to}:${trimmed}`, async () => {
    const translation = await myMemory(trimmed, from, to);
    return translation ? { text: trimmed, translation, source: MYMEMORY_SOURCE } : null;
  });
}
