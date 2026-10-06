import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BackupError,
  createBackup,
  readBackup,
  restoreBackup,
  summarize,
  type BackupSummary,
} from '../services/backup';
import { backupErrorMessage } from '../services/errorMessages';
import { downloadBlob } from '../utils/download';
import { formatBytes } from '../utils/format';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-800">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function describeSummary(summary: BackupSummary): string {
  return `${summary.books} livre(s), ${summary.highlights} surlignage(s), ${summary.words} mot(s) de vocabulaire`;
}

function StatusMessage({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  const color =
    status.kind === 'error'
      ? 'text-red-600'
      : status.kind === 'done'
        ? 'text-green-700 dark:text-green-400'
        : 'text-stone-500';
  return (
    <p role={status.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${color}`}>
      {status.message}
    </p>
  );
}

const buttonClass =
  'rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:hover:bg-stone-700';

function BackupSection() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status.kind === 'busy';

  async function exportData() {
    setStatus({ kind: 'busy', message: 'Préparation de la sauvegarde…' });
    try {
      const backup = await createBackup();
      downloadBlob(`lecture-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, backup);
      setStatus({ kind: 'done', message: `Sauvegarde téléchargée (${formatBytes(backup.size)}).` });
    } catch (error) {
      console.error(error);
      setStatus({ kind: 'error', message: 'La sauvegarde a échoué.' });
    }
  }

  async function importData(file: File) {
    setStatus({ kind: 'busy', message: 'Lecture de la sauvegarde…' });
    try {
      const summary = summarize(await readBackup(file));
      const confirmed = window.confirm(
        `Restaurer cette sauvegarde ?\n\n${describeSummary(summary)}.\n\nLes éléments déjà présents sont remplacés par ceux de la sauvegarde ; le reste est conservé.`,
      );
      if (!confirmed) {
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus({ kind: 'busy', message: 'Restauration en cours…' });
      const restored = await restoreBackup(file);
      setStatus({ kind: 'done', message: `Restauration terminée : ${describeSummary(restored)}.` });
    } catch (error) {
      if (!(error instanceof BackupError)) console.error(error);
      setStatus({
        kind: 'error',
        message: error instanceof BackupError ? backupErrorMessage(error.code) : 'La restauration a échoué.',
      });
    }
  }

  return (
    <Section title="Sauvegarde">
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Tes livres, ta progression, tes surlignages et ton vocabulaire sont stockés uniquement dans ce navigateur.
        Télécharge régulièrement une sauvegarde pour ne rien perdre, ou pour tout retrouver sur un autre appareil.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={exportData} disabled={busy} className={buttonClass}>
          ⤓ Télécharger une sauvegarde
        </button>
        <button onClick={() => inputRef.current?.click()} disabled={busy} className={buttonClass}>
          ⤒ Restaurer une sauvegarde
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importData(file);
          }}
        />
      </div>
      <StatusMessage status={status} />
    </Section>
  );
}

function StorageSection() {
  const [estimate, setEstimate] = useState<{ usage: number; quota: number }>();
  const [persisted, setPersisted] = useState<boolean>();
  const supported = typeof navigator !== 'undefined' && 'storage' in navigator;

  useEffect(() => {
    if (!supported) return;
    void navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => setEstimate({ usage, quota }));
    void navigator.storage.persisted().then(setPersisted);
  }, [supported]);

  if (!supported) return null;

  return (
    <Section title="Stockage">
      {estimate && (
        <p className="text-sm">
          Espace utilisé : <strong>{formatBytes(estimate.usage)}</strong> sur {formatBytes(estimate.quota)} disponibles.
        </p>
      )}
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
        {persisted
          ? '✅ Stockage protégé : le navigateur ne supprimera pas tes données pour libérer de la place.'
          : 'Par défaut, le navigateur peut effacer les données d’un site quand l’espace disque manque.'}
      </p>
      {persisted === false && (
        <button onClick={() => void navigator.storage.persist().then(setPersisted)} className={`${buttonClass} mt-3`}>
          Protéger mes données
        </button>
      )}
    </Section>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">Paramètres</h2>
      <BackupSection />
      <StorageSection />
    </div>
  );
}
