import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import * as en from './__fixtures__/enWiktionary';
import * as fr from './__fixtures__/frWiktionary';
import { LookupError } from './errors';
import { glossesToTranslations, lookupDefinition, lookupTranslation, translateText } from './lookupService';

const MANGER = `== {{langue|fr}} ==
=== {{S|verbe|fr}} ===
'''manger''' {{pron|mɑ̃.ʒe|fr}}
# [[mâcher|Mâcher]] et [[avaler]] un aliment.
`;

const RUN_EN = {
  en: [{ partOfSpeech: 'Verb', language: 'English', definitions: [{ definition: 'To move swiftly.' }] }],
};

/** Pages servies par le faux réseau, selon le site et le titre demandés. */
const enPages: Record<string, unknown> = {
  house: en.HOUSE,
  ran: en.RAN,
  run: RUN_EN,
  maison: en.MAISON,
  mangé: en.MANGE,
  manger: { fr: [{ partOfSpeech: 'Verb', language: 'French', definitions: [{ definition: 'to eat' }] }] },
};
const frPages: Record<string, string> = {
  maison: fr.MAISON,
  mangé: fr.MANGE,
  manger: MANGER,
  house: fr.HOUSE,
  striking: fr.STRIKING,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = new URL(String(input));
  if (url.hostname === 'en.wiktionary.org') {
    const title = decodeURIComponent(url.pathname.split('/').pop()!);
    return title in enPages ? jsonResponse(enPages[title]) : jsonResponse({ status: 404 }, 404);
  }
  if (url.hostname === 'fr.wiktionary.org') {
    const title = url.searchParams.get('page')!;
    return title in frPages
      ? jsonResponse({ parse: { title, wikitext: frPages[title] } })
      : jsonResponse({ error: { code: 'missingtitle' } });
  }
  if (url.hostname === 'api.mymemory.translated.net') {
    return jsonResponse({ responseData: { translatedText: `[${url.searchParams.get('q')}]` }, responseStatus: 200 });
  }
  throw new Error(`URL inattendue : ${url}`);
});

const calls = (host: string) => fetchMock.mock.calls.filter(([input]) => String(input).includes(host)).length;

beforeEach(async () => {
  await db.delete();
  await db.open();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lookupDefinition', () => {
  it('définit un mot anglais avec en.wiktionary', async () => {
    const result = await lookupDefinition('house', 'en');
    expect(result?.lemma).toBeUndefined();
    expect(result?.entry.senses[0].definitions[0].text).toBe(
      'A structure built or serving as an abode of human beings.',
    );
    expect(result?.source.url).toBe('https://en.wiktionary.org/wiki/house');
  });

  it('remplace une forme fléchie anglaise par sa forme de base', async () => {
    const result = await lookupDefinition('ran', 'en');
    expect(result?.lemma).toBe('run');
    expect(result?.entry.senses[0].definitions[0].text).toBe('To move swiftly.');
  });

  it('définit un mot français fléchi avec fr.wiktionary, en gardant sa prononciation', async () => {
    const result = await lookupDefinition('mangé', 'fr');
    expect(result?.lemma).toBe('manger');
    expect(result?.entry.senses[0].definitions[0].text).toBe('Mâcher et avaler un aliment.');
    expect(result?.entry.audioUrl).toContain('Pamputt-mang'); // audio de « mangé »
  });

  it('essaie les formes de base devinées pour un mot inconnu', async () => {
    // « runs » n'a pas de page : « run » est deviné par règle.
    const result = await lookupDefinition('runs', 'en');
    expect(result?.lemma).toBe('run');
  });

  it('renvoie null pour un mot introuvable', async () => {
    expect(await lookupDefinition('zzqx', 'en')).toBeNull();
  });

  it('répond depuis le cache au deuxième appel, y compris pour un mot introuvable', async () => {
    await lookupDefinition('house', 'en');
    await lookupDefinition('zzqx', 'en');
    const before = fetchMock.mock.calls.length;
    expect((await lookupDefinition('house', 'en'))?.word).toBe('house');
    expect(await lookupDefinition('zzqx', 'en')).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});

describe('lookupTranslation', () => {
  /** Groupes simplifiés : forme traduite et traductions. */
  const groups = (result: Awaited<ReturnType<typeof lookupTranslation>>) =>
    result?.groups.map(({ lemma, translations }) => ({ lemma, translations }));

  it('traduit un mot anglais avec les gloses de fr.wiktionary', async () => {
    const result = await lookupTranslation('house', 'en', 'fr');
    expect(groups(result)).toEqual([{ translations: ['Maison (bâtiment)', 'Maison (famille)', 'Loger, héberger'] }]);
    expect(result?.groups[0].source.name).toBe('Wiktionnaire');
  });

  it('traduit d’abord la forme de base, sens de même nature en tête (cas réel « ran »)', async () => {
    // « ran » : abréviation mathématique ET prétérit de « run ».
    frPages.ran = `== {{langue|en}} ==
=== {{S|nom|en}} ===
'''ran'''
# {{mathématiques|en}} [[Im]], [[image]] d’une application linéaire.

=== {{S|verbe|en|flexion}} ===
'''ran''' {{pron|ɹæn|en}}
# ''Prétérit du verbe ''[[run]].
`;
    // La page de « run » liste le nom avant le verbe : le verbe doit passer devant.
    frPages.run = `== {{langue|en}} ==
=== {{S|nom|en}} ===
'''run'''
# [[course|Course]].

=== {{S|verbe|en}} ===
'''run'''
# [[courir|Courir]].
# [[fonctionner|Fonctionner]], [[marcher]].
`;
    const result = await lookupTranslation('ran', 'en', 'fr');
    expect(groups(result)).toEqual([
      { lemma: 'run', translations: ['Courir', 'Fonctionner, marcher', 'Course'] },
      { translations: ['(Mathématiques) Im, image d’une application linéaire'] },
    ]);
    expect(result?.groups[0].source.url).toBe('https://fr.wiktionary.org/wiki/run');
  });

  it('ne propose pas un renvoi de forme comme traduction (cas réel « striking »)', async () => {
    const result = await lookupTranslation('striking', 'en', 'fr');
    // « strike » est absent du faux réseau : seuls les sens propres restent.
    expect(groups(result)).toEqual([{ translations: ['Frappant, remarquable'] }]);
  });

  it('traduit un mot français avec les gloses de en.wiktionary', async () => {
    const result = await lookupTranslation('maison', 'fr', 'en');
    expect(groups(result)).toEqual([{ translations: ['house', 'homemade'] }]);
  });

  it('traduit la forme de base d’une forme fléchie', async () => {
    const result = await lookupTranslation('mangé', 'fr', 'en');
    expect(groups(result)).toEqual([{ lemma: 'manger', translations: ['to eat'] }]);
  });

  it('indique la forme de base devinée par règle', async () => {
    const result = await lookupTranslation('houses', 'en', 'fr');
    expect(groups(result)?.[0].lemma).toBe('house');
  });

  it('se rabat sur MyMemory quand le Wiktionnaire ne connaît pas le mot', async () => {
    const result = await lookupTranslation('zzqx', 'en', 'fr');
    expect(result).toMatchObject({ groups: [{ translations: ['[zzqx]'], source: { name: 'MyMemory' } }] });
    expect(calls('mymemory')).toBe(1);
  });
});

describe('translateText', () => {
  it('traduit une phrase et la met en cache', async () => {
    const first = await translateText('Il était une fois', 'fr', 'en');
    const second = await translateText('Il était une fois', 'fr', 'en');
    expect(first?.translation).toBe('[Il était une fois]');
    expect(second).toEqual(first);
    expect(calls('mymemory')).toBe(1);
  });
});

describe('erreurs réseau', () => {
  it('signale le mode hors ligne sans appeler le réseau', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(lookupDefinition('house', 'en')).rejects.toMatchObject({ kind: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sert les mots déjà consultés hors ligne', async () => {
    await lookupDefinition('house', 'en');
    vi.stubGlobal('navigator', { onLine: false });
    expect((await lookupDefinition('house', 'en'))?.word).toBe('house');
  });

  it('ne met pas une erreur en cache', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(lookupDefinition('house', 'en')).rejects.toBeInstanceOf(LookupError);
    expect((await lookupDefinition('house', 'en'))?.word).toBe('house');
  });

  it('signale un quota dépassé', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
    await expect(translateText('Bonjour', 'fr', 'en')).rejects.toMatchObject({ kind: 'quota' });
  });
});

describe('glossesToTranslations', () => {
  it('ignore les renvois de forme, coupe les notes et retire les doublons', () => {
    expect(
      glossesToTranslations({
        onlyForms: false,
        senses: [
          {
            partOfSpeech: 'Nom',
            definitions: [
              { text: 'Maison (famille). Le « h » est parfois capitalisé.' },
              { text: 'maison (famille).' },
              { text: 'Prétérit de run.', isFormOf: true, formOf: 'run' },
            ],
          },
        ],
      }),
    ).toEqual(['Maison (famille)']);
  });
});
