import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes', () => {
  it.each([
    [0, '0 o'],
    [999, '999 o'],
    [1400, '1,4 Ko'],
    [2_500_000, '2,5 Mo'],
    [150_000_000, '150 Mo'],
    [3_200_000_000, '3,2 Go'],
  ])('%i → %s', (bytes, label) => {
    expect(formatBytes(bytes)).toBe(label.replace(/\s/g, ' '));
  });

  it('utilise les unités anglaises en anglais', () => {
    expect(formatBytes(1400, 'en-US')).toBe('1.4 KB');
  });
});
