import { useRegisterSW } from 'virtual:pwa-register/react';
import { useI18n } from '../i18n';

/**
 * Bandeau du service worker : « prête hors ligne » au premier chargement,
 * puis « nouvelle version » quand une mise à jour attend (appliquée sur demande).
 */
export default function UpdatePrompt() {
  const { t } = useI18n();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker non enregistré', error);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-xl dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
    >
      <span>{needRefresh ? t.update.newVersion : t.update.offlineReady}</span>
      {needRefresh && (
        <button
          onClick={() => void updateServiceWorker(true)}
          className="rounded-lg bg-amber-700 px-3 py-1 text-white hover:bg-amber-800"
        >
          {t.update.update}
        </button>
      )}
      <button
        onClick={close}
        aria-label={t.common.close}
        className="rounded-md px-2 py-1 hover:bg-stone-100 dark:hover:bg-stone-700"
      >
        ✕
      </button>
    </div>
  );
}
