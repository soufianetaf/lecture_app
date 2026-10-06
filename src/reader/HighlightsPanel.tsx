import { useState } from 'react';
import type { Highlight, HighlightColor } from '../db/db';
import { useI18n } from '../i18n';
import { colorFill, HIGHLIGHT_COLORS } from '../services/highlights';

interface Props {
  /** Surlignages déjà triés dans l'ordre de lecture. */
  highlights: Highlight[];
  onSelect(highlight: Highlight): void;
  onExport(): void;
}

export default function HighlightsPanel({ highlights, onSelect, onExport }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<HighlightColor | 'all'>('all');
  const visible = filter === 'all' ? highlights : highlights.filter((h) => h.color === filter);
  const chip = 'rounded-full px-2.5 py-1 text-xs hover:bg-current/10 aria-pressed:bg-current/15';

  return (
    <section aria-label={t.reader.highlightsTitle} className="flex h-full flex-col">
      <div className="border-b border-current/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide opacity-70">
            {t.highlights.panelTitle(highlights.length)}
          </h2>
          <button
            onClick={onExport}
            disabled={highlights.length === 0}
            className="rounded-md px-2 py-1 text-xs hover:bg-current/10 disabled:opacity-40"
            title={t.highlights.exportTitle}
          >
            {t.highlights.export}
          </button>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t.highlights.filter}>
          <button onClick={() => setFilter('all')} aria-pressed={filter === 'all'} className={chip}>
            {t.highlights.all}
          </button>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setFilter(color.value)}
              aria-pressed={filter === color.value}
              className={`${chip} flex items-center gap-1`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color.fill }} aria-hidden />
              {t.highlights.colors[color.value]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="p-3 text-sm opacity-80">
            {highlights.length === 0 ? t.highlights.empty : t.highlights.emptyColor}
          </p>
        ) : (
          <ul className="space-y-1">
            {visible.map((highlight) => (
              <li key={highlight.id}>
                <button
                  onClick={() => onSelect(highlight)}
                  className="w-full rounded-md border-l-4 px-3 py-2 text-left hover:bg-current/10"
                  style={{ borderColor: colorFill(highlight.color) }}
                >
                  {highlight.label && <span className="block text-[11px] opacity-70">{highlight.label}</span>}
                  <span className="line-clamp-3 text-sm">{highlight.text}</span>
                  {highlight.note && (
                    <span className="mt-1 block text-xs italic opacity-80">
                      <span aria-hidden>📝 </span>
                      {highlight.note}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
