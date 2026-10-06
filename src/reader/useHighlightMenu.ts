import { useCallback, useState, type RefObject } from 'react';
import type { HighlightColor } from '../db/db';
import { addHighlight, deleteHighlight, updateHighlight } from '../services/highlightService';
import type { ReaderHandle, ScreenRect, TextSelection } from './types';

export type HighlightMenuState =
  { kind: 'selection'; selection: TextSelection } | { kind: 'edit'; highlightId: string; rect: ScreenRect } | null;

function reportError(action: string, error: unknown) {
  console.error(action, error);
  window.alert(`${action} a échoué. Réessaie.`);
}

/** État du menu flottant et actions sur les surlignages (création, édition, suppression). */
export function useHighlightMenu(bookId: string, viewRef: RefObject<ReaderHandle | null>) {
  const [menu, setMenu] = useState<HighlightMenuState>(null);

  const close = useCallback(() => setMenu(null), []);

  const onSelection = useCallback(
    (selection: TextSelection | null) => setMenu(selection ? { kind: 'selection', selection } : null),
    [],
  );

  const onHighlightClick = useCallback(
    (highlightId: string, rect: ScreenRect) => setMenu({ kind: 'edit', highlightId, rect }),
    [],
  );

  const create = useCallback(
    async (color: HighlightColor) => {
      if (menu?.kind !== 'selection') return;
      const { anchor, text, label } = menu.selection;
      setMenu(null);
      viewRef.current?.clearSelection();
      try {
        await addHighlight({ bookId, anchor, text, label, color });
      } catch (error) {
        reportError('Le surlignage', error);
      }
    },
    [bookId, menu, viewRef],
  );

  const changeColor = useCallback((id: string, color: HighlightColor) => {
    updateHighlight(id, { color }).catch((error) => reportError('Le changement de couleur', error));
  }, []);

  const saveNote = useCallback((id: string, note: string) => {
    setMenu(null);
    updateHighlight(id, { note }).catch((error) => reportError('L’enregistrement de la note', error));
  }, []);

  const remove = useCallback((id: string) => {
    setMenu(null);
    deleteHighlight(id).catch((error) => reportError('La suppression', error));
  }, []);

  return { menu, close, onSelection, onHighlightClick, create, changeColor, saveNote, remove };
}
