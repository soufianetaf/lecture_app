// Traduction automatique par l'API gratuite MyMemory (quota quotidien limité).

import { LookupError } from './errors';
import { decodeEntities } from './html';

export interface MyMemoryResponse {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
  quotaFinished?: boolean;
}

/** Texte traduit, ou erreur `quota` quand la limite gratuite est atteinte. */
export function parseMyMemory(response: MyMemoryResponse): string | null {
  const text = response.responseData?.translatedText ?? '';
  if (
    response.quotaFinished ||
    Number(response.responseStatus) === 429 ||
    /MYMEMORY WARNING|USED ALL AVAILABLE FREE TRANSLATIONS/i.test(text)
  ) {
    throw new LookupError('quota');
  }
  if (Number(response.responseStatus) !== 200) throw new LookupError('service');
  const translation = decodeEntities(text).trim();
  return translation || null;
}
