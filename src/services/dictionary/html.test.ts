import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText } from './html';

describe('decodeEntities', () => {
  it('décode les entités nommées et numériques', () => {
    expect(decodeEntities('Tom &amp; Jerry &#39;ok&#39; &#x2019; &nbsp;!')).toBe("Tom & Jerry 'ok' ’  !");
  });

  it('laisse les entités inconnues', () => {
    expect(decodeEntities('&inconnu;')).toBe('&inconnu;');
  });
});

describe('htmlToText', () => {
  it('retire balises et styles de Wiktionary', () => {
    const html =
      'A structure built or serving as an <a rel="mw:WikiLink" href="/wiki/abode" title="abode">abode</a> of human beings. <style data-mw-deduplicate="x">.mw-parser-output .defdate{font-size:smaller}</style>';
    expect(htmlToText(html)).toBe('A structure built or serving as an abode of human beings.');
  });

  it('retire les liens de catégorie', () => {
    expect(htmlToText('past <link rel="mw:PageProp/Category" href="./Category:X"> participle')).toBe('past participle');
  });
});
