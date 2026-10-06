import type { ReactNode } from 'react';
import type { BookFormat, ColumnWidth, ReaderFont, ReaderTheme, Settings } from '../db/db';
import { useI18n } from '../i18n';
import { THEME_COLORS } from './types';

interface Props {
  format: BookFormat;
  settings: Settings;
  onChange(patch: Partial<Omit<Settings, 'id'>>): void;
}

const THEMES: ReaderTheme[] = ['light', 'sepia', 'dark'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2" role="group" aria-label={label}>
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Stepper({
  setting,
  value,
  onMinus,
  onPlus,
}: {
  /** Nom du réglage, pour des boutons distincts aux lecteurs d'écran (« Taille : augmenter »). */
  setting: string;
  value: string;
  onMinus(): void;
  onPlus(): void;
}) {
  const { t } = useI18n();
  const button = 'h-8 w-8 rounded-md border border-current/20 text-lg leading-none hover:bg-current/10';
  return (
    <>
      <button onClick={onMinus} className={button} aria-label={t.readerSettings.decrease(setting)}>
        −
      </button>
      <span className="w-14 text-center text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <button onClick={onPlus} className={button} aria-label={t.readerSettings.increase(setting)}>
        +
      </button>
    </>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <div className="flex rounded-md border border-current/20 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded px-2.5 py-1 text-sm ${value === option.value ? 'bg-amber-700 text-white' : 'hover:bg-current/10'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPanel({ format, settings, onChange }: Props) {
  const { t } = useI18n();
  const s = t.readerSettings;
  // Pourcentage de réglage (peut dépasser 100 %, contrairement à l'avancement).
  const percent = (value: number) => `${Math.round(value)}${t.locale.startsWith('fr') ? ' ' : ''}%`;
  return (
    <section aria-label={t.reader.settingsTitle} className="w-80 p-4">
      <Row label={s.theme}>
        {THEMES.map((theme) => (
          <button
            key={theme}
            onClick={() => onChange({ theme })}
            aria-pressed={settings.theme === theme}
            title={s.themes[theme]}
            className={`h-9 w-14 rounded-md border text-xs ${settings.theme === theme ? 'ring-2 ring-amber-600' : 'border-black/20'}`}
            style={{ background: THEME_COLORS[theme].background, color: THEME_COLORS[theme].text }}
          >
            {s.themes[theme]}
          </button>
        ))}
      </Row>

      {format === 'epub' ? (
        <>
          <Row label={s.font}>
            <Choice<ReaderFont>
              options={(['serif', 'sans'] as const).map((value) => ({ value, label: s.fonts[value] }))}
              value={settings.fontFamily}
              onChange={(fontFamily) => onChange({ fontFamily })}
            />
          </Row>
          <Row label={s.size}>
            <Stepper
              setting={s.size}
              value={percent(settings.fontSize)}
              onMinus={() => onChange({ fontSize: clamp(settings.fontSize - 10, 70, 200) })}
              onPlus={() => onChange({ fontSize: clamp(settings.fontSize + 10, 70, 200) })}
            />
          </Row>
          <Row label={s.lineHeight}>
            <Stepper
              setting={s.lineHeight}
              value={settings.lineHeight.toLocaleString(t.locale, { minimumFractionDigits: 1 })}
              onMinus={() =>
                onChange({ lineHeight: clamp(Math.round((settings.lineHeight - 0.2) * 10) / 10, 1.2, 2.4) })
              }
              onPlus={() =>
                onChange({ lineHeight: clamp(Math.round((settings.lineHeight + 0.2) * 10) / 10, 1.2, 2.4) })
              }
            />
          </Row>
          <Row label={s.margins}>
            <Choice<ColumnWidth>
              options={(['wide', 'medium', 'narrow'] as const).map((value) => ({
                value,
                label: s.marginOptions[value],
              }))}
              value={settings.columnWidth}
              onChange={(columnWidth) => onChange({ columnWidth })}
            />
          </Row>
        </>
      ) : (
        <>
          <Row label={s.zoom}>
            <Stepper
              setting={s.zoom}
              value={percent(settings.pdfZoom * 100)}
              onMinus={() => onChange({ pdfZoom: clamp(Math.round((settings.pdfZoom - 0.1) * 10) / 10, 0.5, 3) })}
              onPlus={() => onChange({ pdfZoom: clamp(Math.round((settings.pdfZoom + 0.1) * 10) / 10, 0.5, 3) })}
            />
          </Row>
          <button
            onClick={() => onChange({ pdfZoom: 1 })}
            className="mt-1 w-full rounded-md border border-current/20 py-1.5 text-sm hover:bg-current/10"
          >
            {s.fitWidth}
          </button>
        </>
      )}
    </section>
  );
}
