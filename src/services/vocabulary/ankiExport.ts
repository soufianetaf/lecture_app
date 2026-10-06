// Export CSV importable dans Anki (Fichier > Importer), avec les en-têtes
// reconnus par Anki 2.1.55+ : séparateur, HTML autorisé et colonne des étiquettes.

import type { VocabularyWord } from '../../db/db';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Champ CSV (RFC 4180) : entre guillemets si nécessaire, guillemets doublés. */
export function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Étiquette Anki : sans espace (l'espace sépare les étiquettes). */
function tag(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

/** Recto : le mot (forme de base) ; verso : traductions, définition, phrase du livre. */
export function wordsToAnkiCsv(words: VocabularyWord[]): string {
  const lines = ['#separator:comma', '#html:true', '#columns:Recto,Verso,Etiquettes', '#tags column:3'];
  for (const word of words) {
    const front = escapeHtml(word.lemma ?? word.word);
    const back = [
      word.translations.length > 0 ? `<b>${escapeHtml(word.translations.join(', '))}</b>` : '',
      word.definition ? escapeHtml(word.definition) : '',
      word.context ? `<i>« ${escapeHtml(word.context)} »</i>` : '',
    ]
      .filter(Boolean)
      .join('<br>');
    const tags = ['lecture', word.language, word.bookTitle ? tag(word.bookTitle) : ''].filter(Boolean).join(' ');
    lines.push([front, back, tags].map(csvField).join(','));
  }
  return `${lines.join('\n')}\n`;
}
