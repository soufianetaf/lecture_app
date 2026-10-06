export type LookupErrorKind = 'offline' | 'network' | 'timeout' | 'quota' | 'service';

/** Échec d'une recherche, avec une cause exploitable par l'interface (qui choisit le message). */
export class LookupError extends Error {
  readonly kind: LookupErrorKind;

  constructor(kind: LookupErrorKind, options?: { cause?: unknown }) {
    super(`Recherche impossible (${kind})`, options);
    this.name = 'LookupError';
    this.kind = kind;
  }
}
