import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration } from '../modules/ometv/hud';

describe('HUD values', () => {
  it.each([[0, '00:00'], [999, '00:00'], [61000, '01:01'], [3600000, '60:00'], [-1000, '00:00']] as const)
    ('formats %s milliseconds as %s', (value, expected) => expect(formatDuration(value)).toBe(expected));
  it.each([[0, '0'], [9999, '9,999'], [12345, '12.3K']] as const)
    ('keeps counter %s compact as %s', (value, expected) => expect(formatCount(value)).toBe(expected));
});
