// Textes de l'interface en français : dictionnaire de référence.
// L'anglais (en.ts) doit avoir exactement la même forme (vérifié par TypeScript).

import type { BookLanguage, HighlightColor, ReaderTheme, WordStatus } from '../db/db';
import type { BackupErrorCode } from '../services/backup';
import type { LookupErrorKind } from '../services/dictionary/errors';
import type { ImportErrorCode } from '../services/importErrors';
import { formatDuration, formatPercentage } from '../services/progress';
import { formatInterval } from '../services/vocabulary/srs';
import { formatBytes } from '../utils/format';

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => (n > 1 ? pluralForm : singular);

export const fr = {
  locale: 'fr-FR',

  format: {
    percentage: (value: number) => formatPercentage(value, 'fr'),
    duration: (ms: number) => formatDuration(ms, 'fr'),
    interval: (days: number) => formatInterval(days, 'fr'),
    bytes: (bytes: number) => formatBytes(bytes, 'fr-FR'),
    longDate: (date: Date) => date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  },

  common: {
    close: 'Fermer',
    retry: 'Réessayer',
    save: 'Enregistrer',
    delete: 'Supprimer',
    loading: 'Chargement…',
    unknownAuthor: 'Auteur inconnu',
    languages: { fr: 'Français', en: 'Anglais' } as Record<'fr' | 'en', string>,
    /** Nom de langue dans une phrase : « Définition (anglais) ». */
    languagesInline: { fr: 'français', en: 'anglais' } as Record<'fr' | 'en', string>,
  },

  app: {
    name: 'Lecture',
    mainNavigation: 'Navigation principale',
    skipToContent: 'Aller au contenu',
    nav: { library: 'Bibliothèque', vocabulary: 'Vocabulaire', review: 'Révision', settings: 'Paramètres' },
    dueWords: (n: number) => `${n} ${plural(n, 'mot')} à réviser`,
    displayError: 'Un problème est survenu à l’affichage.',
    readerError: 'Le lecteur a rencontré un problème.',
    dictionaryError: 'Le dictionnaire a rencontré un problème.',
  },

  update: {
    offlineReady: 'L’application fonctionne maintenant hors ligne.',
    newVersion: 'Une nouvelle version est disponible.',
    update: 'Mettre à jour',
  },

  library: {
    title: 'Ma bibliothèque',
    search: 'Rechercher un titre ou un auteur',
    sort: 'Trier',
    sortOptions: { recent: 'Récents', title: 'Titre', author: 'Auteur' },
    add: '+ Ajouter un livre',
    importing: 'import en cours…',
    added: (title: string) => `« ${title} » ajouté.`,
    unexpectedImportError: 'Erreur inattendue pendant l’import de ce fichier.',
    emptyTitle: 'Glisse un PDF, un EPUB ou un TXT ici',
    emptyHint: 'ou clique pour choisir un fichier',
    noMatch: (query: string) => `Aucun livre ne correspond à « ${query} ».`,
    dropHere: 'Dépose tes livres PDF, EPUB ou TXT',
  },

  book: {
    read: (title: string) => `Lire ${title}`,
    deleteLabel: (title: string) => `Supprimer ${title}`,
    confirmDelete: (title: string) => `Supprimer « ${title} » de la bibliothèque ? Sa progression sera aussi effacée.`,
    deleteFailed: 'La suppression a échoué. Réessaie.',
    language: 'Langue du livre',
    languageShort: { fr: 'FR', en: 'EN', unknown: '?' } as Record<BookLanguage, string>,
    notStarted: 'Non commencé',
    finished: 'Terminé',
  },

  importErrors: {
    unsupported: () => 'Format non pris en charge : seuls les fichiers PDF, EPUB et TXT sont acceptés.',
    duplicate: (title?: string) => `« ${title ?? ''} » est déjà dans la bibliothèque.`,
    pdfUnreadable: () => 'Ce PDF est illisible ou protégé par mot de passe.',
    scanned: () =>
      'Ce PDF semble scanné : il ne contient pas de texte sélectionnable. Il ne peut pas être lu pour l’instant.',
    epubUnreadable: () => 'Cet EPUB est illisible ou mal formé.',
    emptyText: () => 'Ce fichier texte est vide.',
  } as Record<ImportErrorCode, (detail?: string) => string>,

  reader: {
    back: '← Bibliothèque',
    backTitle: 'Retour à la bibliothèque',
    toc: '☰ Sommaire',
    tocTitle: 'Table des matières',
    highlights: '✎ Surlignages',
    highlightsTitle: 'Surlignages et notes',
    settings: 'Aa Réglages',
    settingsTitle: 'Réglages de lecture',
    opening: 'Ouverture du livre…',
    missing: 'Ce livre n’existe plus dans la bibliothèque.',
    backToLibrary: 'Retour à la bibliothèque',
    previousPage: 'Page précédente',
    nextPage: 'Page suivante',
    progress: 'Avancement dans le livre',
    page: (current: number, total: number) => `Page ${current} / ${total}`,
    chapterPage: (current: number, total: number) => `Page ${current} / ${total} du chapitre`,
    errors: {
      loadBook: 'Impossible de charger ce livre.',
      openPdf: 'Impossible d’ouvrir ce PDF.',
      openEpub: 'Impossible d’ouvrir cet EPUB.',
      renderPage: 'Impossible d’afficher cette page.',
    },
    highlightsFile: 'surlignages',
  },

  toc: {
    empty: 'Ce livre n’a pas de table des matières.',
  },

  readerSettings: {
    theme: 'Thème',
    themes: { light: 'Clair', sepia: 'Sépia', dark: 'Sombre' } as Record<ReaderTheme, string>,
    font: 'Police',
    fonts: { serif: 'Serif', sans: 'Sans' },
    size: 'Taille',
    lineHeight: 'Interligne',
    margins: 'Marges',
    marginOptions: { wide: 'Petites', medium: 'Moyennes', narrow: 'Grandes' },
    zoom: 'Zoom',
    fitWidth: 'Ajuster à la largeur',
    decrease: (setting: string) => `${setting} : diminuer`,
    increase: (setting: string) => `${setting} : augmenter`,
  },

  highlights: {
    colors: { yellow: 'Jaune', green: 'Vert', pink: 'Rose', blue: 'Bleu' } as Record<HighlightColor, string>,
    colorGroup: 'Couleur du surlignage',
    highlightIn: (color: string) => `Surligner en ${color.toLowerCase()}`,
    selectionToolbar: 'Surligner la sélection',
    translate: 'Traduire',
    translateTitle: 'Traduire le passage',
    edit: 'Modifier le surlignage',
    deleteTitle: 'Supprimer le surlignage',
    notePlaceholder: 'Ajouter une note…',
    panelTitle: (n: number) => `Surlignages (${n})`,
    export: '⤓ Exporter',
    exportTitle: 'Exporter en Markdown',
    filter: 'Filtrer par couleur',
    all: 'Toutes',
    empty: 'Aucun surlignage. Sélectionne du texte pour en créer un.',
    emptyColor: 'Aucun surlignage de cette couleur.',
    errors: {
      create: 'Le surlignage a échoué. Réessaie.',
      color: 'Le changement de couleur a échoué. Réessaie.',
      note: 'L’enregistrement de la note a échoué. Réessaie.',
      delete: 'La suppression a échoué. Réessaie.',
    },
    markdown: {
      count: (n: number) => `${n} ${plural(n, 'surlignage')}`,
      note: 'Note :',
    },
  },

  dictionary: {
    title: 'Dictionnaire',
    textTitle: 'Traduction du passage',
    wordPanel: 'Définition et traduction',
    textPanel: 'Traduction',
    close: 'Fermer le dictionnaire',
    askLanguage: 'Dans quelle langue est ce livre ?',
    formOf: 'forme de',
    otherSenses: '(autres sens)',
    definition: (language: string) => `Définition (${language})`,
    translation: (language: string) => `Traduction (${language})`,
    noDefinition: (word: string) => `Aucune définition trouvée pour « ${word} ».`,
    noTranslation: 'Aucune traduction trouvée.',
    truncated: (n: number) => `Seuls les ${n} premiers caractères sont traduits.`,
    source: (name: string) => `Source : ${name}`,
    listen: 'Écouter la prononciation',
    audioUnavailable: 'Prononciation audio indisponible',
    save: '☆ Ajouter au vocabulaire',
    saved: '★ Dans ton vocabulaire',
    saveTitle: 'Ajouter au vocabulaire',
    removeTitle: 'Retirer du vocabulaire',
    saveFailed: 'L’enregistrement a échoué. Réessaie.',
    errors: {
      offline: 'Tu es hors ligne. Les mots déjà consultés restent disponibles.',
      network: 'Impossible de joindre le dictionnaire. Vérifie ta connexion.',
      timeout: 'Le dictionnaire met trop de temps à répondre. Réessaie.',
      quota: 'La limite quotidienne de traduction est atteinte. Réessaie demain.',
      service: 'Le service est momentanément indisponible. Réessaie plus tard.',
    } as Record<LookupErrorKind, string>,
    unexpectedError: 'Une erreur inattendue est survenue.',
  },

  vocabulary: {
    title: 'Mon vocabulaire',
    statuses: { new: 'Nouveau', learning: 'En cours', known: 'Acquis' } as Record<WordStatus, string>,
    statusOf: (word: string) => `Statut de ${word}`,
    metAs: (word: string) => `rencontré sous la forme « ${word} »`,
    remove: (word: string) => `Retirer ${word}`,
    removeTitle: 'Retirer du vocabulaire',
    confirmRemove: (word: string) => `Retirer « ${word} » du vocabulaire ?`,
    dueNow: 'à réviser maintenant',
    nextReview: (interval: string) => `révision ${interval}`,
    exportAnki: '⤓ Exporter pour Anki',
    exportAnkiTitle: 'Fichier CSV à importer dans Anki (Fichier › Importer)',
    exportFile: 'vocabulaire-lecture.csv',
    review: (n: number) => `Réviser (${n})`,
    empty: 'Ton vocabulaire est vide.',
    emptyHint: 'Pendant la lecture, double-clique sur un mot puis choisis « ☆ Ajouter au vocabulaire ».',
    search: 'Rechercher un mot ou une traduction',
    language: 'Langue',
    allLanguages: 'Toutes les langues',
    book: 'Livre',
    allBooks: 'Tous les livres',
    status: 'Statut',
    allStatuses: 'Tous les statuts',
    noMatch: 'Aucun mot ne correspond à ces filtres.',
  },

  review: {
    grades: { again: 'À revoir', hard: 'Difficile', good: 'Bien', easy: 'Facile' },
    noTranslation: 'Pas de traduction enregistrée.',
    done: 'Séance terminée !',
    nothingDue: 'Rien à réviser pour le moment.',
    summary: (reviewed: number, forgotten: number) =>
      `${reviewed} ${plural(reviewed, 'réponse')}, dont ${forgotten} ${plural(forgotten, 'mot')} à revoir.`,
    nextSession: (date: string) => `Prochaine révision le ${date}.`,
    backToVocabulary: 'Retour au vocabulaire',
    back: '← Vocabulaire',
    remaining: (n: number) => `${n} ${plural(n, 'carte')} ${plural(n, 'restante')}`,
    showAnswer: 'Afficher la réponse',
    spaceKey: '(Espace)',
    yourAnswer: 'Ta réponse',
    loadFailed: 'Impossible de charger les mots à réviser.',
    saveFailed: 'La réponse n’a pas été enregistrée. Réessaie.',
  },

  settings: {
    title: 'Paramètres',
    interface: 'Interface',
    interfaceLanguage: 'Langue de l’interface',
    backup: 'Sauvegarde',
    backupIntro:
      'Tes livres, ta progression, tes surlignages et ton vocabulaire sont stockés uniquement dans ce navigateur. Télécharge régulièrement une sauvegarde pour ne rien perdre, ou pour tout retrouver sur un autre appareil.',
    download: '⤓ Télécharger une sauvegarde',
    restore: '⤒ Restaurer une sauvegarde',
    preparing: 'Préparation de la sauvegarde…',
    downloaded: (size: string) => `Sauvegarde téléchargée (${size}).`,
    backupFailed: 'La sauvegarde a échoué.',
    reading: 'Lecture de la sauvegarde…',
    summary: (books: number, highlights: number, words: number) =>
      `${books} ${plural(books, 'livre')}, ${highlights} ${plural(highlights, 'surlignage')}, ${words} ${plural(words, 'mot')} de vocabulaire`,
    confirmRestore: (summary: string) =>
      `Restaurer cette sauvegarde ?\n\n${summary}.\n\nLes éléments déjà présents sont remplacés par ceux de la sauvegarde ; le reste est conservé.`,
    restoring: 'Restauration en cours…',
    restored: (summary: string) => `Restauration terminée : ${summary}.`,
    restoreFailed: 'La restauration a échoué.',
    backupFileName: 'lecture-sauvegarde',
    storage: 'Stockage',
    usage: (used: string, quota: string) => `Espace utilisé : ${used} sur ${quota} disponibles.`,
    persisted: '✅ Stockage protégé : le navigateur ne supprimera pas tes données pour libérer de la place.',
    notPersisted: 'Par défaut, le navigateur peut effacer les données d’un site quand l’espace disque manque.',
    protect: 'Protéger mes données',
  },

  backupErrors: {
    invalidJson: 'Ce fichier n’est pas une sauvegarde valide (JSON illisible).',
    notBackup: 'Ce fichier n’est pas une sauvegarde de Lecture.',
    newerVersion: 'Cette sauvegarde vient d’une version plus récente de l’application.',
    incomplete: 'Sauvegarde incomplète.',
    corrupted: 'Sauvegarde corrompue.',
  } as Record<BackupErrorCode, string>,
};

export type Messages = typeof fr;
