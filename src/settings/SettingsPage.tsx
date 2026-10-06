import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n, type Messages, type UiLanguage } from '../i18n';
import {
  BackupError,
  createBackup,
  readBackup,
  restoreBackup,
  summarize,
  type BackupSummary,
} from '../services/backup';
import { downloadBlob } from '../utils/download';

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

function describeSummary(summary: BackupSummary, t: Messages): string {
  return t.settings.summary(summary.books, summary.highlights, summary.words);
}

function StatusMessage({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  const color =
    status.kind === 'error'
      ? 'text-red-700 dark:text-red-400'
      : status.kind === 'done'
        ? 'text-green-700 dark:text-green-400'
        : 'text-stone-600 dark:text-stone-300';
  return (
    <p role={status.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${color}`}>
      {status.message}
    </p>
  );
}

const buttonClass =
  'rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:hover:bg-stone-700';

function InterfaceSection() {
  const { t, language, setLanguage } = useI18n();
  return (
    <Section title={t.settings.interface}>
      <label className="flex items-center justify-between gap-4 text-sm">
        {t.settings.interfaceLanguage}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as UiLanguage)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-stone-600 dark:bg-stone-800"
        >
          {/* Chaque langue est écrite dans sa propre langue, pour être reconnue même sans la comprendre. */}
          <option value="fr" lang="fr">
            Français
          </option>
          <option value="en" lang="en">
            English
          </option>
        </select>
      </label>
    </Section>
  );
}

function BackupSection() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status.kind === 'busy';

  async function exportData() {
    setStatus({ kind: 'busy', message: t.settings.preparing });
    try {
      const backup = await createBackup();
      downloadBlob(`${t.settings.backupFileName}-${new Date().toISOString().slice(0, 10)}.json`, backup);
      setStatus({ kind: 'done', message: t.settings.downloaded(t.format.bytes(backup.size)) });
    } catch (error) {
      console.error(error);
      setStatus({ kind: 'error', message: t.settings.backupFailed });
    }
  }

  async function importData(file: File) {
    setStatus({ kind: 'busy', message: t.settings.reading });
    try {
      const summary = summarize(await readBackup(file));
      if (!window.confirm(t.settings.confirmRestore(describeSummary(summary, t)))) {
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus({ kind: 'busy', message: t.settings.restoring });
      const restored = await restoreBackup(file);
      setStatus({ kind: 'done', message: t.settings.restored(describeSummary(restored, t)) });
    } catch (error) {
      if (!(error instanceof BackupError)) console.error(error);
      setStatus({
        kind: 'error',
        message: error instanceof BackupError ? t.backupErrors[error.code] : t.settings.restoreFailed,
      });
    }
  }

  return (
    <Section title={t.settings.backup}>
      <p className="text-sm text-stone-600 dark:text-stone-300">{t.settings.backupIntro}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={exportData} disabled={busy} className={buttonClass}>
          {t.settings.download}
        </button>
        <button onClick={() => inputRef.current?.click()} disabled={busy} className={buttonClass}>
          {t.settings.restore}
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
  const { t } = useI18n();
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
    <Section title={t.settings.storage}>
      {estimate && (
        <p className="text-sm">{t.settings.usage(t.format.bytes(estimate.usage), t.format.bytes(estimate.quota))}</p>
      )}
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
        {persisted ? t.settings.persisted : t.settings.notPersisted}
      </p>
      {persisted === false && (
        <button onClick={() => void navigator.storage.persist().then(setPersisted)} className={`${buttonClass} mt-3`}>
          {t.settings.protect}
        </button>
      )}
    </Section>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">{t.settings.title}</h2>
      <InterfaceSection />
      <BackupSection />
      <StorageSection />
    </div>
  );
}
