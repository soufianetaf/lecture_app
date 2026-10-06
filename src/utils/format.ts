/** « 1,4 Mo » : taille lisible, en unités décimales comme les navigateurs. */
export function formatBytes(bytes: number, locale = 'fr-FR'): string {
  const units = locale.startsWith('fr') ? ['o', 'Ko', 'Mo', 'Go'] : ['B', 'KB', 'MB', 'GB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${units[unit]}`;
}
