// Analyse du wikitexte de fr.wiktionary.org : sections de langue, natures
// du mot, définitions, exemples, prononciation et formes fléchies.

import type { Definition, DictionaryEntry, LookupLanguage, Sense } from './types';

/** Libellés lisibles des natures de mot du Wiktionnaire. */
const PART_OF_SPEECH: Record<string, string> = {
  nom: 'Nom commun',
  'nom propre': 'Nom propre',
  verbe: 'Verbe',
  adjectif: 'Adjectif',
  adverbe: 'Adverbe',
  pronom: 'Pronom',
  'pronom personnel': 'Pronom personnel',
  préposition: 'Préposition',
  conjonction: 'Conjonction',
  interjection: 'Interjection',
  'article défini': 'Article défini',
  'article indéfini': 'Article indéfini',
  'adjectif possessif': 'Adjectif possessif',
  'adjectif démonstratif': 'Adjectif démonstratif',
  'locution phrase': 'Locution',
};

/** Modèles qui affichent leur premier paramètre comme texte. */
const TEXT_TEMPLATES = new Set(['lien', 'l', 'w', 'lien-ancre-étym', 'lang', 'nobr']);

/** Découpe les paramètres d'un modèle en respectant les {{…}} et [[…]] imbriqués. */
export function splitTemplateParams(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === '{{' || two === '[[') {
      depth++;
      current += two;
      i++;
    } else if ((two === '}}' || two === ']]') && depth > 0) {
      depth--;
      current += two;
      i++;
    } else if (inner[i] === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += inner[i];
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim());
}

function positional(params: string[]): string[] {
  return params.filter((p) => !/^[\w\s-]+=/.test(p));
}

function named(params: string[], name: string): string | undefined {
  const prefix = new RegExp(`^${name}\\s*=`);
  const found = params.find((p) => prefix.test(p));
  return found?.replace(prefix, '').trim();
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Rendu texte d'un modèle {{nom|params}} (sans accolades). */
function renderTemplate(inner: string): string {
  const [rawName, ...params] = splitTemplateParams(inner);
  const name = rawName.trim();
  const args = positional(params);
  if (TEXT_TEMPLATES.has(name)) return named(params, 'dif') ?? args[0] ?? '';
  if (name === 'term') return args[0] ? `(${args[0]})` : '';
  // Étiquette de domaine ou de registre : {{figuré|fr}}, {{cuisine|fr}}…
  if (args.length === 1 && /^[a-z]{2,3}$/.test(args[0]) && /^[\p{Ll}][\p{L} -]*$/u.test(name)) {
    return `(${capitalize(name)})`;
  }
  return '';
}

/** Convertit un fragment de wikitexte en texte lisible. */
export function cleanWikitext(text: string): string {
  let result = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/g, '')
    .replace(/<[^>]+>/g, '');
  // Modèles du plus imbriqué au plus externe.
  let previous;
  do {
    previous = result;
    result = result.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => renderTemplate(inner));
  } while (result !== previous);
  return (
    result
      .replace(/\[\[(?:Image|Fichier|File|Catégorie|Category):[^\]]*\]\]/gi, '')
      .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
      .replace(/\[\[([^\]]*)\]\]/g, (_, target: string) => target.replace(/#.*$/, ''))
      .replace(/'{2,}/g, '')
      .replace(/\s+/g, ' ')
      // Espaces laissées par les modèles retirés ; on garde l'espace française avant ; : ! ?
      .replace(/\s+([.,)])/g, '$1')
      .replace(/\(\s+/g, '(')
      .trim()
  );
}

/** Texte de la section de langue `== {{langue|xx}} ==`, ou `null` si absente. */
export function languageSection(wikitext: string, language: LookupLanguage): string | null {
  const start = wikitext.search(new RegExp(`^==\\s*\\{\\{langue\\|${language}\\}\\}\\s*==\\s*$`, 'm'));
  if (start < 0) return null;
  const rest = wikitext.slice(start + 1);
  const next = rest.search(/^==\s*\{\{langue\|/m);
  return next < 0 ? wikitext.slice(start) : wikitext.slice(start, start + 1 + next);
}

/** Lit un modèle {{exemple|…}} éventuellement réparti sur plusieurs lignes. */
function readExample(lines: string[], index: number): { example?: string; translation?: string; next: number } {
  let text = lines[index].replace(/^#+\*\s*/, '');
  let next = index + 1;
  const open = () => (text.match(/\{\{/g)?.length ?? 0) - (text.match(/\}\}/g)?.length ?? 0);
  while (open() > 0 && next < lines.length) text += `\n${lines[next++]}`;

  const match = text.match(/^\{\{\s*exemple\s*\|([\s\S]*)\}\}\s*$/);
  if (!match) {
    const plain = cleanWikitext(text);
    return { example: plain || undefined, next };
  }
  const params = splitTemplateParams(match[1]);
  const example = positional(params)[0];
  const translation = named(params, 'sens');
  return {
    example: example ? cleanWikitext(example) || undefined : undefined,
    translation: translation ? cleanWikitext(translation) || undefined : undefined,
    next,
  };
}

interface PosHeading {
  partOfSpeech: string;
  isFlexion: boolean;
}

/** `=== {{S|nom|fr|flexion}} ===` → nature du mot ; `null` pour les autres sections. */
function parsePosHeading(line: string, language: LookupLanguage): PosHeading | null {
  const match = line.match(/^={3,}\s*\{\{S\|([^}]*)\}\}\s*={3,}\s*$/);
  if (!match) return null;
  const params = splitTemplateParams(match[1]);
  if (params[1] !== language) return null;
  const type = params[0].toLowerCase();
  return { partOfSpeech: PART_OF_SPEECH[type] ?? capitalize(type), isFlexion: params.includes('flexion') };
}

/**
 * Forme de base visée par une définition de forme fléchie : premier lien
 * `[[cible]]` ou modèle `{{lien|cible|…}}`.
 */
function linkTarget(line: string): string | undefined {
  return line
    .match(/\[\[([^\]|#]+)|\{\{\s*(?:lien|l)\s*\|([^|}#]+)/)
    ?.slice(1)
    .find(Boolean)
    ?.trim();
}

/** Analyse la section d'une langue d'une page du Wiktionnaire. */
export function parseFrWiktionary(wikitext: string, language: LookupLanguage): DictionaryEntry | null {
  const section = languageSection(wikitext, language);
  if (!section) return null;

  const lines = section.split('\n');
  const senses: Sense[] = [];
  let current: (Sense & { isFlexion: boolean }) | null = null;
  let lemma: string | undefined;
  let onlyForms = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('==')) {
      const heading = parsePosHeading(line, language);
      current = heading ? { partOfSpeech: heading.partOfSpeech, definitions: [], isFlexion: heading.isFlexion } : null;
      if (current) senses.push(current);
      continue;
    }
    if (!current) continue;

    // Définition principale (« # … ») ; on ignore les sous-sens (« ## »).
    if (/^#(?![#*:])/.test(line)) {
      const text = cleanWikitext(line.replace(/^#\s*/, ''));
      if (!text) continue;
      const definition: Definition = { text };
      current.definitions.push(definition);
      if (current.isFlexion) {
        definition.isFormOf = true;
        definition.formOf = linkTarget(line);
        lemma ??= definition.formOf;
      } else {
        onlyForms = false;
      }

      // Premier exemple non vide qui suit la définition.
      let j = i + 1;
      while (j < lines.length && /^#[*:]/.test(lines[j])) {
        if (!definition.example && lines[j].startsWith('#*')) {
          const { example, translation, next } = readExample(lines, j);
          if (example) {
            definition.example = example;
            definition.exampleTranslation = translation;
          }
          j = next;
        } else {
          j++;
        }
      }
      i = j - 1;
    }
  }

  const filled = senses
    .filter((s) => s.definitions.length > 0)
    .map(({ partOfSpeech, definitions }) => ({ partOfSpeech, definitions }));
  if (filled.length === 0) return null;

  const pronunciation = section.match(/\{\{pron\|([^|}]+)\|/)?.[1]?.trim();
  const audioFile = section.match(/\{\{écouter\|[^}]*?audio=([^|}]+)/)?.[1]?.trim();
  return {
    senses: filled,
    lemma: onlyForms ? lemma : undefined,
    onlyForms,
    pronunciation,
    audioUrl: audioFile
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(audioFile)}`
      : undefined,
  };
}
