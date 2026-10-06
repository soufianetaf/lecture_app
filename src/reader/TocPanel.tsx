import { useI18n } from '../i18n';
import type { TocItem } from './types';

interface Props {
  toc: TocItem[];
  onSelect(item: TocItem): void;
}

function TocList({ items, depth, onSelect }: { items: TocItem[]; depth: number; onSelect(item: TocItem): void }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => onSelect(item)}
            disabled={item.target === null}
            className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-current/10 disabled:opacity-40"
            style={{ paddingLeft: 12 + depth * 16 }}
          >
            {item.label}
          </button>
          {item.children.length > 0 && <TocList items={item.children} depth={depth + 1} onSelect={onSelect} />}
        </li>
      ))}
    </ul>
  );
}

export default function TocPanel({ toc, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <nav aria-label={t.reader.tocTitle} className="h-full overflow-y-auto p-3">
      <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide opacity-70">{t.reader.tocTitle}</h2>
      {toc.length === 0 ? (
        <p className="px-3 text-sm opacity-80">{t.toc.empty}</p>
      ) : (
        <TocList items={toc} depth={0} onSelect={onSelect} />
      )}
    </nav>
  );
}
