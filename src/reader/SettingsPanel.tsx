import type { ReactNode } from 'react';
import type { BookFormat, ColumnWidth, ReaderFont, ReaderTheme, Settings } from '../db/db';
import { THEME_COLORS } from './types';

interface Props {
  format: BookFormat;
  settings: Settings;
  onChange(patch: Partial<Omit<Settings, 'id'>>): void;
}

const THEMES: { value: ReaderTheme; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'sepia', label: 'Sépia' },
  { value: 'dark', label: 'Sombre' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: string; onMinus(): void; onPlus(): void }) {
  const button = 'h-8 w-8 rounded-md border border-current/20 text-lg leading-none hover:bg-current/10';
  return (
    <>
      <button onClick={onMinus} className={button} aria-label="Diminuer">
        −
      </button>
      <span className="w-14 text-center text-sm tabular-nums">{value}</span>
      <button onClick={onPlus} className={button} aria-label="Augmenter">
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
          className={`rounded px-2.5 py-1 text-sm ${value === option.value ? 'bg-amber-600 text-white' : 'hover:bg-current/10'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPanel({ format, settings, onChange }: Props) {
  return (
    <div className="w-80 p-4">
      <Row label="Thème">
        {THEMES.map((theme) => (
          <button
            key={theme.value}
            onClick={() => onChange({ theme: theme.value })}
            aria-pressed={settings.theme === theme.value}
            title={theme.label}
            className={`h-9 w-14 rounded-md border text-xs ${settings.theme === theme.value ? 'ring-2 ring-amber-600' : 'border-black/20'}`}
            style={{ background: THEME_COLORS[theme.value].background, color: THEME_COLORS[theme.value].text }}
          >
            {theme.label}
          </button>
        ))}
      </Row>

      {format === 'epub' ? (
        <>
          <Row label="Police">
            <Choice<ReaderFont>
              options={[
                { value: 'serif', label: 'Serif' },
                { value: 'sans', label: 'Sans' },
              ]}
              value={settings.fontFamily}
              onChange={(fontFamily) => onChange({ fontFamily })}
            />
          </Row>
          <Row label="Taille">
            <Stepper
              value={`${settings.fontSize} %`}
              onMinus={() => onChange({ fontSize: clamp(settings.fontSize - 10, 70, 200) })}
              onPlus={() => onChange({ fontSize: clamp(settings.fontSize + 10, 70, 200) })}
            />
          </Row>
          <Row label="Interligne">
            <Stepper
              value={settings.lineHeight.toFixed(1)}
              onMinus={() =>
                onChange({ lineHeight: clamp(Math.round((settings.lineHeight - 0.2) * 10) / 10, 1.2, 2.4) })
              }
              onPlus={() =>
                onChange({ lineHeight: clamp(Math.round((settings.lineHeight + 0.2) * 10) / 10, 1.2, 2.4) })
              }
            />
          </Row>
          <Row label="Marges">
            <Choice<ColumnWidth>
              options={[
                { value: 'wide', label: 'Petites' },
                { value: 'medium', label: 'Moyennes' },
                { value: 'narrow', label: 'Grandes' },
              ]}
              value={settings.columnWidth}
              onChange={(columnWidth) => onChange({ columnWidth })}
            />
          </Row>
        </>
      ) : (
        <>
          <Row label="Zoom">
            <Stepper
              value={`${Math.round(settings.pdfZoom * 100)} %`}
              onMinus={() => onChange({ pdfZoom: clamp(Math.round((settings.pdfZoom - 0.1) * 10) / 10, 0.5, 3) })}
              onPlus={() => onChange({ pdfZoom: clamp(Math.round((settings.pdfZoom + 0.1) * 10) / 10, 0.5, 3) })}
            />
          </Row>
          <button
            onClick={() => onChange({ pdfZoom: 1 })}
            className="mt-1 w-full rounded-md border border-current/20 py-1.5 text-sm hover:bg-current/10"
          >
            Ajuster à la largeur
          </button>
        </>
      )}
    </div>
  );
}
