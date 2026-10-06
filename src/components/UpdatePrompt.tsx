import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Bandeau du service worker : « prête hors ligne » au premier chargement,
 * puis « nouvelle version » quand une mise à jour attend (appliquée sur demande).
 */
export default function UpdatePrompt() {
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
      <span>
        {needRefresh ? 'Une nouvelle version est disponible.' : 'L’application fonctionne maintenant hors ligne.'}
      </span>
      {needRefresh && (
        <button
          onClick={() => void updateServiceWorker(true)}
          className="rounded-lg bg-amber-600 px-3 py-1 text-white hover:bg-amber-700"
        >
          Mettre à jour
        </button>
      )}
      <button
        onClick={close}
        aria-label="Fermer"
        className="rounded-md px-2 py-1 hover:bg-stone-100 dark:hover:bg-stone-700"
      >
        ✕
      </button>
    </div>
  );
}
