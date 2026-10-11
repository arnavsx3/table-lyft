import { describe, expect, it } from 'vitest';
import { decide, DetectionConsensus } from '../modules/ometv/decision';
import { DEFAULT_SETTINGS, normalizeSettings, normalizeStats } from '../modules/preferences';

describe('filter decisions', () => {
  it.each([
    ['girls_only', 'male', 'skip'], ['girls_only', 'female', 'keep'],
    ['boys_only', 'male', 'keep'], ['boys_only', 'female', 'skip'],
    ['all', 'male', 'wait'], ['all', 'female', 'wait'], ['all', 'unknown', 'wait'],
    ['girls_only', 'unknown', 'wait'], ['boys_only', 'unknown', 'wait'],
  ] as const)('%s + %s = %s', (targetGender, gender, expected) => {
    expect(decide(gender, { ...DEFAULT_SETTINGS, targetGender })).toBe(expected);
    expect(decide(gender, { ...DEFAULT_SETTINGS, targetGender, enabled: false })).toBe('wait');
  });

  it('only skips uncertain results when explicitly enabled', () => {
    expect(decide('unknown', { ...DEFAULT_SETTINGS, skipUnknown: true })).toBe('skip');
    expect(decide('unknown', { ...DEFAULT_SETTINGS, targetGender: 'all', skipUnknown: true })).toBe('wait');
  });
});

describe('consensus', () => {
  it('requires three consecutive confident frames of the same prediction', () => {
    const consensus = new DetectionConsensus();
    expect(consensus.add('male', 0.99, 0.85)).toBeNull();
    expect(consensus.add('female', 0.99, 0.85)).toBeNull();
    expect(consensus.add('female', 0.99, 0.85)).toBeNull();
    expect(consensus.add('unknown', 1, 0.85)).toBeNull();
    expect(consensus.add('female', 0.99, 0.85)).toBeNull();
    expect(consensus.add('female', 0.99, 0.85)).toBeNull();
    expect(consensus.add('female', 0.99, 0.85)).toBe('female');
  });

  it('resets on low or invalid confidence', () => {
    const consensus = new DetectionConsensus();
    consensus.add('male', 0.99, 0.85);
    consensus.add('male', 0.99, 0.85);
    expect(consensus.add('male', NaN, 0.85)).toBeNull();
    expect(consensus.add('male', 0.99, 0.85)).toBeNull();
    expect(consensus.add('male', 0.7, 0.85)).toBeNull();
    expect(consensus.add('male', 0.99, 0.85)).toBeNull();
  });
});

describe('stored data migration', () => {
  it('preserves existing preferences while filling new defaults', () => {
    expect(normalizeSettings({ enabled: false, targetGender: 'boys_only', autoReconnectOnDisconnect: true }))
      .toEqual({ ...DEFAULT_SETTINGS, enabled: false, targetGender: 'boys_only' });
  });

  it('rejects corrupt types and clamps unsafe numeric settings', () => {
    const settings = normalizeSettings({ enabled: 'false', targetGender: 'invalid', skipDelayMinMs: -100,
      skipDelayMaxMs: 10, unknownTimeoutMs: Infinity, minimumConfidence: 0.1 });
    expect(settings).toMatchObject({ enabled: true, targetGender: 'girls_only', skipDelayMinMs: 150,
      skipDelayMaxMs: 150, unknownTimeoutMs: 8000, minimumConfidence: 0.7 });
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeStats({ totalSkipped: -9, totalKept: 2.5, femalesMatched: '4' }))
      .toMatchObject({ totalSkipped: 0, totalKept: 2, femalesMatched: 0, unknownSkipped: 0 });
  });
});
