import { useCallback, useState, type RefObject } from 'react';
import type { HighlightColor } from '../db/db';
import { useI18n } from '../i18n';
import { addHighlight, deleteHighlight, updateHighlight } from '../services/highlightService';
import type { ReaderHandle, ScreenRect, TextSelection } from './types';

export type HighlightMenuState =
  { kind: 'selection'; selection: TextSelection } | { kind: 'edit'; highlightId: string; rect: ScreenRect } | null;

function reportError(message: string, error: unknown) {
  console.error(message, error);
  window.alert(message);
}

/** État du menu flottant et actions sur les surlignages (création, édition, suppression). */
export function useHighlightMenu(bookId: string, viewRef: RefObject<ReaderHandle | null>) {
  const { t } = useI18n();
  const errors = t.highlights.errors;
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
        reportError(errors.create, error);
      }
    },
    [bookId, menu, viewRef, errors],
  );

  const changeColor = useCallback(
    (id: string, color: HighlightColor) => {
      updateHighlight(id, { color }).catch((error) => reportError(errors.color, error));
    },
    [errors],
  );

  const saveNote = useCallback(
    (id: string, note: string) => {
      setMenu(null);
      updateHighlight(id, { note }).catch((error) => reportError(errors.note, error));
    },
    [errors],
  );

  const remove = useCallback(
    (id: string) => {
      setMenu(null);
      deleteHighlight(id).catch((error) => reportError(errors.delete, error));
    },
    [errors],
  );

  return { menu, close, onSelection, onHighlightClick, create, changeColor, saveNote, remove };
}
