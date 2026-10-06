import { useI18n } from '../i18n';
import { clamp01 } from '../services/progress';

interface Props {
  /** Avancement entre 0 et 1. */
  value: number;
  /** Nom de la barre pour les lecteurs d'écran. */
  label?: string;
  className?: string;
}

/** Barre d'avancement accessible (lue comme « 45 % » par les lecteurs d'écran). */
export default function ProgressBar({ value, label, className = '' }: Props) {
  const { t } = useI18n();
  const percentage = clamp01(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(percentage * 100)}
      aria-valuetext={t.format.percentage(percentage)}
      className={`h-1 overflow-hidden rounded-full bg-current/15 ${className}`}
    >
      <div className="h-full rounded-full bg-amber-600 transition-[width]" style={{ width: `${percentage * 100}%` }} />
    </div>
  );
}
