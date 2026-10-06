import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Highlight, HighlightColor } from '../db/db';
import { useI18n } from '../i18n';
import { HIGHLIGHT_COLORS } from '../services/highlights';
import type { ScreenRect } from './types';

/** Place le menu au-dessus de la sélection, ou en dessous s'il n'y a pas la place. */
function menuPosition(rect: ScreenRect, halfWidth: number): CSSProperties {
  const center = (rect.left + rect.right) / 2;
  const left = Math.min(Math.max(center, halfWidth + 8), window.innerWidth - halfWidth - 8);
  return rect.top > 160
    ? { left, top: rect.top - 8, transform: 'translate(-50%, -100%)' }
    : { left, top: rect.bottom + 8, transform: 'translate(-50%, 0)' };
}

function ColorButtons({ selected, onPick }: { selected?: HighlightColor; onPick(color: HighlightColor): void }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1.5" role="group" aria-label={t.highlights.colorGroup}>
      {HIGHLIGHT_COLORS.map((color) => {
        const name = t.highlights.colors[color.value];
        return (
          <button
            key={color.value}
            onClick={() => onPick(color.value)}
            aria-label={t.highlights.highlightIn(name)}
            aria-pressed={selected === color.value}
            title={name}
            className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
              selected === color.value ? 'border-stone-900 dark:border-white' : 'border-transparent'
            }`}
            style={{ background: color.fill }}
          />
        );
      })}
    </div>
  );
}

const panelClass =
  'fixed z-30 rounded-xl border border-stone-200 bg-white p-2 text-stone-900 shadow-xl dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100';

/** Menu affiché sur une sélection : choisir une couleur crée le surlignage. */
export function SelectionMenu({
  rect,
  onPick,
  onTranslate,
}: {
  rect: ScreenRect;
  onPick(color: HighlightColor): void;
  /** Proposé pour un passage de plusieurs mots (un mot seul s'ouvre directement au dictionnaire). */
  onTranslate?(): void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`${panelClass} flex items-center gap-2`}
      style={menuPosition(rect, onTranslate ? 120 : 80)}
      role="toolbar"
      aria-label={t.highlights.selectionToolbar}
    >
      <ColorButtons onPick={onPick} />
      {onTranslate && (
        <button
          onClick={onTranslate}
          className="rounded-md border-l border-current/15 px-2 py-1 text-sm hover:bg-current/10"
          title={t.highlights.translateTitle}
        >
          {t.highlights.translate}
        </button>
      )}
    </div>
  );
}

interface EditProps {
  highlight: Highlight;
  rect: ScreenRect;
  onColor(color: HighlightColor): void;
  onNote(note: string): void;
  onDelete(): void;
  onClose(): void;
}

/** Menu d'un surlignage existant : couleur, note, suppression. */
export function HighlightEditMenu({ highlight, rect, onColor, onNote, onDelete, onClose }: EditProps) {
  const { t } = useI18n();
  const [note, setNote] = useState(highlight.note ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dirty = note.trim() !== (highlight.note ?? '');

  useEffect(() => {
    if (highlight.note) textareaRef.current?.focus();
  }, [highlight.note]);

  return (
    <div className={`${panelClass} w-72`} style={menuPosition(rect, 144)} role="dialog" aria-label={t.highlights.edit}>
      <div className="flex items-center justify-between gap-2 px-1">
        <ColorButtons selected={highlight.color} onPick={onColor} />
        <button
          onClick={onDelete}
          className="rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          title={t.highlights.deleteTitle}
        >
          {t.common.delete}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl+Entrée enregistre ; Échap ferme sans enregistrer.
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onNote(note);
          if (e.key === 'Escape') onClose();
          e.stopPropagation();
        }}
        placeholder={t.highlights.notePlaceholder}
        aria-label={t.highlights.notePlaceholder}
        rows={3}
        className="mt-2 w-full resize-none rounded-md border border-stone-300 bg-transparent p-2 text-sm dark:border-stone-600"
      />
      <div className="mt-1 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md px-3 py-1 text-sm hover:bg-current/10">
          {t.common.close}
        </button>
        <button
          onClick={() => onNote(note)}
          disabled={!dirty}
          className="rounded-md bg-amber-700 px-3 py-1 text-sm text-white hover:bg-amber-800 disabled:opacity-40"
        >
          {t.common.save}
        </button>
      </div>
    </div>
  );
}
