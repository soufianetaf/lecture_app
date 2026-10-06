// Sauvegarde et restauration de toutes les données locales dans un fichier JSON.
// Les fichiers (livres, couvertures) sont encodés en base64. Le cache du
// dictionnaire n'est pas sauvegardé : il se reconstruit tout seul.

import type { Table } from 'dexie';
import { db } from '../db/db';

export const BACKUP_FORMAT = 'lecture-backup';
export const BACKUP_VERSION = 1;

/** Tables sauvegardées, dans l'ordre de restauration. */
const TABLES = ['books', 'settings', 'progress', 'readingSessions', 'epubLocations', 'highlights', 'words'] as const;
type TableName = (typeof TABLES)[number];

export type BackupErrorCode = 'invalidJson' | 'notBackup' | 'newerVersion' | 'incomplete' | 'corrupted';

/** Sauvegarde refusée, identifiée par un code (le message est choisi par l'interface). */
export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'BackupError';
    this.code = code;
  }
}

interface SerializedBlob {
  $blob: string;
  type: string;
}

interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Partial<Record<TableName, Record<string, unknown>[]>>;
}

export type BackupSummary = Record<TableName, number>;

const CHUNK = 0x8000;

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Par morceaux : String.fromCharCode(...tout) dépasserait la pile sur un gros livre.
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

const isSerializedBlob = (value: unknown): value is SerializedBlob =>
  typeof value === 'object' && value !== null && typeof (value as SerializedBlob).$blob === 'string';

async function serializeRecord(record: object): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value instanceof Blob ? { $blob: await blobToBase64(value), type: value.type } : value;
  }
  return out;
}

function deserializeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = isSerializedBlob(value) ? base64ToBlob(value.$blob, value.type) : value;
  }
  return out;
}

const table = (name: TableName) => db.table(name) as Table<Record<string, unknown>>;

/** Fichier de sauvegarde (JSON) contenant toutes les données de l'application. */
export async function createBackup(now = new Date()): Promise<Blob> {
  const tables: BackupFile['tables'] = {};
  for (const name of TABLES) {
    const records = await table(name).toArray();
    tables[name] = await Promise.all(records.map(serializeRecord));
  }
  const backup: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), tables };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

/** Lit et vérifie un fichier de sauvegarde, sans rien modifier. */
export async function readBackup(file: Blob): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new BackupError('invalidJson');
  }
  const backup = parsed as Partial<BackupFile>;
  if (backup?.format !== BACKUP_FORMAT) throw new BackupError('notBackup');
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) throw new BackupError('newerVersion');
  if (typeof backup.tables !== 'object' || backup.tables === null) throw new BackupError('incomplete');
  for (const name of TABLES) {
    const records = backup.tables[name];
    if (records !== undefined && !Array.isArray(records)) throw new BackupError('corrupted', name);
  }
  return backup as BackupFile;
}

export function summarize(backup: BackupFile): BackupSummary {
  return Object.fromEntries(TABLES.map((name) => [name, backup.tables[name]?.length ?? 0])) as BackupSummary;
}

/**
 * Restaure une sauvegarde en la fusionnant avec les données existantes :
 * un élément de même identifiant est remplacé par celui de la sauvegarde,
 * les autres sont conservés. Tout ou rien : une seule transaction.
 */
export async function restoreBackup(file: Blob): Promise<BackupSummary> {
  const backup = await readBackup(file);
  await db.transaction('rw', TABLES.map(table), async () => {
    for (const name of TABLES) {
      const records = (backup.tables[name] ?? []).map(deserializeRecord);
      if (name === 'words') {
        // Un même mot (langue + forme de base) peut exister ici sous un autre identifiant :
        // la version de la sauvegarde remplace la locale (l'index est unique).
        for (const word of records) {
          const existing = await db.words
            .where('[language+key]')
            .equals([word.language as string, word.key as string])
            .first();
          if (existing && existing.id !== word.id) await db.words.delete(existing.id);
        }
      }
      await table(name).bulkPut(records);
    }
  });
  return summarize(backup);
}
