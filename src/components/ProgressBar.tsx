import { clamp01, formatPercentage } from '../services/progress';

interface Props {
  /** Avancement entre 0 et 1. */
  value: number;
  className?: string;
}

/** Barre d'avancement accessible (lue comme « 45 % » par les lecteurs d'écran). */
export default function ProgressBar({ value, className = '' }: Props) {
  const percentage = clamp01(value);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(percentage * 100)}
      aria-valuetext={formatPercentage(percentage)}
      className={`h-1 overflow-hidden rounded-full bg-current/15 ${className}`}
    >
      <div className="h-full rounded-full bg-amber-600 transition-[width]" style={{ width: `${percentage * 100}%` }} />
    </div>
  );
}
