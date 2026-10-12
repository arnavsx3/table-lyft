import { freshStats, normalizeSettings, normalizeStats } from './preferences';
import type { GenderType, WingmanSettings } from './types';

export const SETTINGS_KEY = 'wingman_settings';
export const STATS_KEY = 'wingman_stats';

export type Mutation =
  | { type: 'settings'; patch: Partial<WingmanSettings> }
  | { type: 'toggle' }
  | { type: 'session' }
  | { type: 'manualSkip' }
  | { type: 'skip'; gender: GenderType }
  | { type: 'keep'; gender: GenderType }
  | { type: 'reset' };

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export function isMutation(value: unknown): value is Mutation {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if (['toggle', 'reset', 'session', 'manualSkip'].includes(String(input.type))) return true;
  if (input.type === 'settings') return !!input.patch && typeof input.patch === 'object' && !Array.isArray(input.patch);
  return (input.type === 'skip' || input.type === 'keep') && ['male', 'female', 'unknown'].includes(String(input.gender));
}

// All extension contexts send mutations to this one background queue.
export function createStorageService(storage: StorageArea) {
  let tail: Promise<unknown> = Promise.resolve();
  return (mutation: Mutation): Promise<unknown> => {
    const task = tail.then(async () => {
      if (mutation.type === 'settings' || mutation.type === 'toggle') {
        const data = await storage.get(SETTINGS_KEY);
        const current = normalizeSettings(data[SETTINGS_KEY]);
        const updated = normalizeSettings({ ...current, ...(mutation.type === 'toggle'
          ? { enabled: !current.enabled } : mutation.patch) });
        await storage.set({ [SETTINGS_KEY]: updated });
        return updated;
      }
      const data = await storage.get(STATS_KEY);
      const stats = mutation.type === 'reset' ? freshStats() : normalizeStats(data[STATS_KEY]);
      if (mutation.type === 'session') stats.totalSessions++;
      else if (mutation.type === 'manualSkip') stats.totalSkipped++;
      else if (mutation.type === 'skip') {
        stats.totalSkipped++;
        if (mutation.gender === 'male') stats.malesSkipped++;
        if (mutation.gender === 'unknown') stats.unknownSkipped++;
      } else if (mutation.type === 'keep') {
        stats.totalKept++;
        if (mutation.gender === 'female') stats.femalesMatched++;
      }
      await storage.set({ [STATS_KEY]: stats });
      return stats;
    });
    tail = task.catch(() => undefined);
    return task;
  };
}
