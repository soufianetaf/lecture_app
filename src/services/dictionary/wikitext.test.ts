import { describe, expect, it } from 'vitest';
import { HOUSE, MAISON, MANGE, RAN, STRIKING } from './__fixtures__/frWiktionary';
import { cleanWikitext, languageSection, parseFrWiktionary, splitTemplateParams } from './wikitext';

describe('splitTemplateParams', () => {
  it('respecte les modèles et liens imbriqués', () => {
    expect(splitTemplateParams('exemple|lang=fr|Texte [[a|b]]|source={{w|X|Y}}')).toEqual([
      'exemple',
      'lang=fr',
      'Texte [[a|b]]',
      'source={{w|X|Y}}',
    ]);
  });
});

describe('cleanWikitext', () => {
  it('rend les liens, le gras et les étiquettes', () => {
    expect(cleanWikitext("{{édifices|fr}} [[bâtiment|Bâtiment]] servant de [[logis]], d’'''habitation'''.")).toBe(
      '(Édifices) Bâtiment servant de logis, d’habitation.',
    );
  });

  it('garde le texte des modèles de lien et retire les autres', () => {
    expect(cleanWikitext("''{{lien|habitation|fr}}'' {{f}} {{pron|me.zɔ̃|fr}}")).toBe('habitation');
  });

  it('retire images, commentaires et références', () => {
    expect(cleanWikitext('[[Image:x.jpg|thumb|légende]]Texte<!-- note --><ref>source</ref>.')).toBe('Texte.');
  });

  it('retire l’ancre des liens', () => {
    expect(cleanWikitext('[[ménage#fr]]')).toBe('ménage');
  });
});

describe('languageSection', () => {
  it('isole la section demandée', () => {
    const section = languageSection(MAISON, 'fr');
    expect(section).toContain('{{S|nom|fr}}');
    expect(section).not.toContain('ancien français');
  });

  it('renvoie null si la langue est absente', () => {
    expect(languageSection(MAISON, 'en')).toBeNull();
  });
});

describe('parseFrWiktionary', () => {
  it('extrait natures, définitions, exemples et prononciation', () => {
    const entry = parseFrWiktionary(MAISON, 'fr')!;
    expect(entry.onlyForms).toBe(false);
    expect(entry.lemma).toBeUndefined();
    expect(entry.pronunciation).toBe('me.zɔ̃');
    expect(entry.audioUrl).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Fr-maison.ogg');
    expect(entry.senses.map((s) => s.partOfSpeech)).toEqual(['Nom commun', 'Adjectif']);

    const [first, second] = entry.senses[0].definitions;
    expect(first.text).toBe('(Édifices) Bâtiment servant de logis, d’habitation, de demeure.');
    expect(first.example).toBe('Les maisons peuvent brûler, les fortunes sombrer.');
    expect(second.text).toBe('Ménage, foyer ; tout ce qui a rapport aux affaires domestiques.');
    expect(second.example).toBe('C’était elle qui assumait dans la maison les travaux de l’homme.');
    // Les sous-sens (« ## ») et les traductions ne sont pas des définitions.
    expect(entry.senses[0].definitions).toHaveLength(2);
  });

  it('reconnaît une forme fléchie et sa forme de base', () => {
    const entry = parseFrWiktionary(MANGE, 'fr')!;
    expect(entry.onlyForms).toBe(true);
    expect(entry.lemma).toBe('manger');
    expect(entry.senses[0].definitions[0].text).toBe('Participe passé masculin singulier de manger.');
    // Exemple réparti sur plusieurs lignes.
    expect(entry.senses[0].definitions[0].example).toBe(
      'Une soupe aux herbes, le tout servi et mangé dans des assiettes écornées.',
    );
  });

  it('lit la section anglaise : gloses en français et traduction d’exemple', () => {
    const entry = parseFrWiktionary(HOUSE, 'en')!;
    expect(entry.senses.map((s) => s.partOfSpeech)).toEqual(['Nom commun', 'Verbe']);
    const [building, family] = entry.senses[0].definitions;
    expect(building.text).toBe('Maison (bâtiment).');
    expect(building.example).toBeUndefined(); // modèle d'exemple vide
    expect(family.example).toBe('The House of Windsor came into being in 1917.');
    expect(family.exampleTranslation).toBe('La maison de Windsor est née en 1917.');
  });

  it('trouve la forme de base d’un verbe anglais fléchi', () => {
    const entry = parseFrWiktionary(RAN, 'en')!;
    expect(entry.onlyForms).toBe(true);
    expect(entry.lemma).toBe('run');
  });

  it('marque les renvois de forme d’une entrée mixte, même écrits avec {{lien}}', () => {
    const entry = parseFrWiktionary(STRIKING, 'en')!;
    // L'adjectif a un vrai sens : l'entrée n'est pas qu'un renvoi.
    expect(entry.onlyForms).toBe(false);
    const [participle] = entry.senses[0].definitions;
    expect(participle).toMatchObject({ isFormOf: true, formOf: 'strike', text: 'Participe présent de strike.' });
    expect(entry.senses[1].definitions[0].isFormOf).toBeUndefined();
  });

  it('renvoie null quand la langue est absente', () => {
    expect(parseFrWiktionary(MANGE, 'en')).toBeNull();
  });
});
