import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db, DEFAULT_SETTINGS, type Settings } from '../db/db';

type SettingsPatch = Partial<Omit<Settings, 'id'>>;

export function useSettings(): [Settings, (patch: SettingsPatch) => void] {
  const stored = useLiveQuery(() => db.settings.get('app'), []);
  // Objet stable tant que les réglages ne changent pas, pour ne pas relancer
  // les effets qui en dépendent à chaque rendu.
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...stored }), [stored]);

  const update = useCallback(
    (patch: SettingsPatch) => {
      void db.settings.put({ ...settings, ...patch, id: 'app' });
    },
    [settings],
  );

  return [settings, update];
}
