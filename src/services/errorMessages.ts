// Messages des erreurs métier (codes renvoyés par les services).
// Point d'entrée unique pour la future traduction de l'interface.

import type { BackupErrorCode } from './backup';
import type { ImportErrorCode } from './importErrors';

export function importErrorMessage(code: ImportErrorCode, detail?: string): string {
  switch (code) {
    case 'unsupported':
      return 'Format non pris en charge : seuls les fichiers PDF, EPUB et TXT sont acceptés.';
    case 'duplicate':
      return `« ${detail ?? ''} » est déjà dans la bibliothèque.`;
    case 'pdfUnreadable':
      return 'Ce PDF est illisible ou protégé par mot de passe.';
    case 'scanned':
      return 'Ce PDF semble scanné : il ne contient pas de texte sélectionnable. Il ne peut pas être lu pour l’instant.';
    case 'epubUnreadable':
      return 'Cet EPUB est illisible ou mal formé.';
    case 'emptyText':
      return 'Ce fichier texte est vide.';
  }
}

export function backupErrorMessage(code: BackupErrorCode): string {
  switch (code) {
    case 'invalidJson':
      return 'Ce fichier n’est pas une sauvegarde valide (JSON illisible).';
    case 'notBackup':
      return 'Ce fichier n’est pas une sauvegarde de Lecture.';
    case 'newerVersion':
      return 'Cette sauvegarde vient d’une version plus récente de l’application.';
    case 'incomplete':
      return 'Sauvegarde incomplète.';
    case 'corrupted':
      return 'Sauvegarde corrompue.';
  }
}

/** Auteur affiché : l'auteur inconnu est stocké vide. */
export function displayAuthor(author: string): string {
  return author.trim() || 'Auteur inconnu';
}
