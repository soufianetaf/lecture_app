export type LookupErrorKind = 'offline' | 'network' | 'timeout' | 'quota' | 'service';

/** Échec d'une recherche, avec une cause exploitable par l'interface. */
export class LookupError extends Error {
  readonly kind: LookupErrorKind;

  constructor(kind: LookupErrorKind, options?: { cause?: unknown }) {
    super(`Recherche impossible (${kind})`, options);
    this.name = 'LookupError';
    this.kind = kind;
  }
}

const MESSAGES: Record<LookupErrorKind, string> = {
  offline: 'Tu es hors ligne. Les mots déjà consultés restent disponibles.',
  network: 'Impossible de joindre le dictionnaire. Vérifie ta connexion.',
  timeout: 'Le dictionnaire met trop de temps à répondre. Réessaie.',
  quota: 'La limite quotidienne de traduction est atteinte. Réessaie demain.',
  service: 'Le service est momentanément indisponible. Réessaie plus tard.',
};

export function lookupErrorMessage(error: unknown): string {
  return error instanceof LookupError ? MESSAGES[error.kind] : 'Une erreur inattendue est survenue.';
}
