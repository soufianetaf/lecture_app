// Analyse de l'API REST de en.wiktionary.org (définitions groupées par langue, en HTML).

import { htmlToText } from './html';
import type { Definition, DictionaryEntry, LookupLanguage, Sense } from './types';

interface RestDefinition {
  definition: string;
  parsedExamples?: { example: string; translation?: string }[];
}

interface RestUsage {
  partOfSpeech: string;
  language: string;
  definitions: RestDefinition[];
}

/** Réponse de /page/definition : usages par code de langue. */
export type RestDefinitionResponse = Partial<Record<string, RestUsage[]>>;

/** Nom de langue utilisé par en.wiktionary pour chaque code. */
const LANGUAGE_NAMES: Record<LookupLanguage, string> = { en: 'English', fr: 'French' };

/** « simple past of run » : la forme de base est dans `.form-of-definition-link`. */
function formOfLemma(html: string): string | undefined {
  const match = html.match(/class="form-of-definition-link"[\s\S]*?<a [^>]*title="([^"]+)"/);
  return match?.[1];
}

/** Analyse les entrées d'une langue donnée (« en » : mot anglais, « fr » : mot français). */
export function parseEnWiktionary(response: RestDefinitionResponse, language: LookupLanguage): DictionaryEntry | null {
  const usages = (response[language] ?? []).filter((usage) => usage.language === LANGUAGE_NAMES[language]);
  const senses: Sense[] = [];
  let lemma: string | undefined;
  let onlyForms = true;

  for (const usage of usages) {
    const definitions: Definition[] = [];
    for (const raw of usage.definitions) {
      const text = htmlToText(raw.definition);
      if (!text) continue;
      const formOf = formOfLemma(raw.definition);
      if (formOf) lemma ??= formOf;
      else onlyForms = false;
      const example = raw.parsedExamples?.[0];
      definitions.push({
        text,
        example: example ? htmlToText(example.example) || undefined : undefined,
        exampleTranslation: example?.translation ? htmlToText(example.translation) || undefined : undefined,
        isFormOf: formOf !== undefined || undefined,
        formOf,
      });
    }
    if (definitions.length > 0) senses.push({ partOfSpeech: usage.partOfSpeech, definitions });
  }

  if (senses.length === 0) return null;
  return { senses, lemma: onlyForms ? lemma : undefined, onlyForms };
}
