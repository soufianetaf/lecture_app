export type ImportErrorCode =
  'unsupported' | 'duplicate' | 'pdfUnreadable' | 'scanned' | 'epubUnreadable' | 'emptyText';

/**
 * Erreur d'import, identifiée par un code : l'interface la traduit dans la
 * langue choisie. Dans un module à part pour que la bibliothèque puisse la
 * reconnaître sans charger pdf.js ni epub.js.
 */
export class ImportError extends Error {
  readonly code: ImportErrorCode;
  /** Précision affichée dans le message (ex. titre du livre déjà présent). */
  readonly detail?: string;

  constructor(code: ImportErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ImportError';
    this.code = code;
    this.detail = detail;
  }
}
