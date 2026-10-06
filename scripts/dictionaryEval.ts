// Évaluation du dictionnaire sur 50 mots par langue (critère de l'étape 5 :
// au moins 90 % de résultats utiles, moins de 1,5 s par mot).
//
// Interroge les vrais services : à lancer dans le navigateur, serveur de dev démarré :
//   const { runDictionaryEval } = await import('/scripts/dictionaryEval.ts');
//   await runDictionaryEval();

import { lookupDefinition, lookupTranslation } from '../src/services/dictionary/lookupService';
import type { LookupLanguage } from '../src/services/dictionary/types';

/** Mots courants, formes fléchies (conjugaisons, pluriels) et mots plus rares. */
export const EVAL_WORDS: Record<LookupLanguage, string[]> = {
  fr: [
    'maison',
    'jardin',
    'enfant',
    'mer',
    'ville',
    'portail',
    'curiosité',
    'automne',
    'herbe',
    'puits',
    'rouillé',
    'vieille',
    'trésors',
    'racontaient',
    'décida',
    'pousser',
    'osé',
    'franchir',
    'grille',
    'peur',
    'mangé',
    'chevaux',
    'yeux',
    'allions',
    'fussent',
    'aperçut',
    'lueur',
    'sombre',
    'murmura',
    'soudain',
    'chemin',
    'fenêtre',
    'escalier',
    'carnet',
    'humide',
    'poussiéreux',
    'sentier',
    'ronces',
    'pluie',
    'feuillage',
    'mélancolie',
    'éphémère',
    'nonchalance',
    'quiétude',
    'désormais',
    'néanmoins',
    'aïeul',
    'chuchoter',
    'blêmir',
    'vergogne',
  ],
  en: [
    'house',
    'garden',
    'child',
    'street',
    'empty',
    'story',
    'sailor',
    'treasure',
    'gate',
    'morning',
    'ran',
    'striking',
    'remembered',
    'whispered',
    'built',
    'slowed',
    'children',
    'leaves',
    'stepped',
    'brambles',
    'bright',
    'cold',
    'rusty',
    'notebook',
    'staircase',
    'swollen',
    'damp',
    'leather',
    'hesitated',
    'narrow',
    'wonder',
    'quickly',
    'although',
    'beneath',
    'thought',
    'caught',
    'mice',
    'wives',
    'better',
    'went',
    'ephemeral',
    'serendipity',
    'melancholy',
    'nonchalant',
    'eerie',
    'lingering',
    'threshold',
    'glimpse',
    'shimmer',
    'wistful',
  ],
};

interface WordReport {
  word: string;
  definition: boolean;
  translation: boolean;
  lemma?: string;
  ms: number;
  error?: string;
}

async function evaluate(word: string, language: LookupLanguage): Promise<WordReport> {
  const target: LookupLanguage = language === 'fr' ? 'en' : 'fr';
  const start = performance.now();
  try {
    const [definition, translation] = await Promise.all([
      lookupDefinition(word, language),
      lookupTranslation(word, language, target),
    ]);
    return {
      word,
      definition: definition !== null,
      translation: translation !== null && translation.groups.some((g) => g.translations.length > 0),
      lemma: definition?.lemma,
      ms: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      word,
      definition: false,
      translation: false,
      ms: Math.round(performance.now() - start),
      error: String(error),
    };
  }
}

export async function runDictionaryEval() {
  const summary: Record<string, unknown> = {};
  for (const language of ['fr', 'en'] as const) {
    const reports: WordReport[] = [];
    // Un mot à la fois, comme un lecteur réel (et pour ménager les services gratuits).
    for (const word of EVAL_WORDS[language]) reports.push(await evaluate(word, language));
    const useful = reports.filter((r) => r.definition && r.translation);
    const times = reports.map((r) => r.ms).sort((a, b) => a - b);
    summary[language] = {
      useful: `${useful.length}/${reports.length}`,
      definitionOnly: reports.filter((r) => r.definition && !r.translation).map((r) => r.word),
      failures: reports.filter((r) => !r.definition).map((r) => (r.error ? `${r.word} (${r.error})` : r.word)),
      lemmas: reports.filter((r) => r.lemma).map((r) => `${r.word}→${r.lemma}`),
      medianMs: times[Math.floor(times.length / 2)],
      p90Ms: times[Math.floor(times.length * 0.9)],
      over1500ms: reports.filter((r) => r.ms > 1500).map((r) => `${r.word} (${r.ms} ms)`),
    };
  }
  return summary;
}
