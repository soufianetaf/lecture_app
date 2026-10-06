export type LookupLanguage = 'fr' | 'en';

export interface Definition {
  text: string;
  example?: string;
  /** Traduction de l'exemple, quand la source la fournit. */
  exampleTranslation?: string;
  /** Définition qui renvoie à une autre forme (« simple past of run ») : jamais une traduction. */
  isFormOf?: boolean;
  /** Forme de base visée par ce renvoi, quand elle est identifiable (« run »). */
  formOf?: string;
}

export interface Sense {
  /** Nature du mot (« Nom commun », « Verb »…), dans la langue de la source. */
  partOfSpeech: string;
  definitions: Definition[];
}

/** Entrée de dictionnaire extraite d'une source, indépendante de son format. */
export interface DictionaryEntry {
  senses: Sense[];
  /** Forme de base quand le mot est une forme fléchie (« ran » → « run »). */
  lemma?: string;
  /** Toutes les définitions renvoient à une autre forme (« pluriel de… »). */
  onlyForms: boolean;
  /** Prononciation API, sans barres obliques. */
  pronunciation?: string;
  audioUrl?: string;
}

export interface Source {
  name: string;
  url: string;
  license?: string;
}

export interface DefinitionResult {
  /** Mot cherché. */
  word: string;
  /** Forme de base effectivement définie, si différente du mot cherché. */
  lemma?: string;
  entry: DictionaryEntry;
  source: Source;
}

/** Traductions d'une forme du mot (le mot lui-même, ou sa forme de base). */
export interface TranslationGroup {
  /** Forme de base traduite (« strike » pour « striking ») ; absente pour le mot lui-même. */
  lemma?: string;
  translations: string[];
  source: Source;
}

export interface TranslationResult {
  word: string;
  /** Forme de base d'abord quand le mot est fléchi, puis les sens propres du mot. */
  groups: TranslationGroup[];
}

export interface TextTranslationResult {
  text: string;
  translation: string;
  source: Source;
}
