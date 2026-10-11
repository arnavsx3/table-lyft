import { describe, expect, it, vi } from 'vitest';
import { createStorageService, isMutation, SETTINGS_KEY, STATS_KEY } from '../modules/storage-service';

function memoryStorage() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (key: string) => ({ [key]: structuredClone(data[key]) })),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(data, structuredClone(items)); }),
  };
}

describe('background storage queue', () => {
  it('migrates old counters and serializes manual sessions/skips without assigning a gender', async () => {
    const storage = memoryStorage();
    storage.data[STATS_KEY] = { totalSkipped: 4, totalKept: 2, malesSkipped: 3 };
    const mutate = createStorageService(storage);
    await Promise.all(Array.from({ length: 10 }, () => mutate({ type: 'session' })));
    await Promise.all(Array.from({ length: 7 }, () => mutate({ type: 'manualSkip' })));
    expect(storage.data[STATS_KEY]).toMatchObject({ totalSessions: 10, totalSkipped: 11, malesSkipped: 3, unknownSkipped: 0, totalKept: 2 });
    await mutate({ type: 'reset' });
    expect(storage.data[STATS_KEY]).toMatchObject({ totalSessions: 0, totalSkipped: 0 });
  });
  it('preserves all concurrent statistics and settings mutations', async () => {
    const storage = memoryStorage();
    const mutate = createStorageService(storage);
    await Promise.all([
      ...Array.from({ length: 30 }, () => mutate({ type: 'skip', gender: 'male' })),
      mutate({ type: 'skip', gender: 'female' }), mutate({ type: 'skip', gender: 'unknown' }),
      mutate({ type: 'keep', gender: 'female' }), mutate({ type: 'keep', gender: 'male' }),
      mutate({ type: 'settings', patch: { enabled: false } }),
      mutate({ type: 'settings', patch: { soundAlertOnMatch: false } }),
    ]);
    expect(storage.data[STATS_KEY]).toMatchObject({ totalSkipped: 32, malesSkipped: 30, unknownSkipped: 1,
      totalKept: 2, femalesMatched: 1 });
    expect(storage.data[SETTINGS_KEY]).toMatchObject({ enabled: false, soundAlertOnMatch: false });
  });

  it('orders reset and subsequent updates', async () => {
    const storage = memoryStorage();
    const mutate = createStorageService(storage);
    await Promise.all([mutate({ type: 'skip', gender: 'male' }), mutate({ type: 'reset' }), mutate({ type: 'keep', gender: 'male' })]);
    expect(storage.data[STATS_KEY]).toMatchObject({ totalSkipped: 0, totalKept: 1 });
  });

  it('recovers after a storage failure without blocking later writes', async () => {
    const storage = memoryStorage();
    storage.set.mockRejectedValueOnce(new Error('disk failure'));
    const mutate = createStorageService(storage);
    await expect(mutate({ type: 'skip', gender: 'male' })).rejects.toThrow('disk failure');
    await mutate({ type: 'skip', gender: 'male' });
    expect(storage.data[STATS_KEY]).toMatchObject({ totalSkipped: 1 });
  });

  it('toggles against the latest saved value', async () => {
    const storage = memoryStorage();
    const mutate = createStorageService(storage);
    await Promise.all([mutate({ type: 'toggle' }), mutate({ type: 'toggle' })]);
    expect(storage.data[SETTINGS_KEY]).toMatchObject({ enabled: true });
  });

  it('rejects malformed messages', () => {
    for (const value of [null, {}, { type: 'settings', patch: [] }, { type: 'skip', gender: 'invalid' }]) expect(isMutation(value)).toBe(false);
    expect(isMutation({ type: 'skip', gender: 'unknown' })).toBe(true);
  });
});
