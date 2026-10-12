import { browser } from 'wxt/browser';
import { normalizeSettings, normalizeStats } from './preferences';
import { SETTINGS_KEY, STATS_KEY, type Mutation } from './storage-service';
import type { GenderType, WingmanSettings, WingmanStats } from './types';

export { DEFAULT_SETTINGS } from './preferences';

export async function getSettings(): Promise<WingmanSettings> {
  const data = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}

export async function getStats(): Promise<WingmanStats> {
  const data = await browser.storage.local.get(STATS_KEY);
  return normalizeStats(data[STATS_KEY]);
}

async function mutate<T>(mutation: Mutation): Promise<T> {
  const result = await browser.runtime.sendMessage({ type: 'WINGMAN_MUTATE', mutation });
  if (!result?.ok) throw new Error(result?.error || 'Could not save changes. Reload the extension and try again.');
  return result.value as T;
}

export const saveSettings = (patch: Partial<WingmanSettings>) => mutate<WingmanSettings>({ type: 'settings', patch });
export const toggleEnabled = () => mutate<WingmanSettings>({ type: 'toggle' });
export const recordSkip = (gender: GenderType) => mutate<WingmanStats>({ type: 'skip', gender });
export const recordMatch = (gender: GenderType) => mutate<WingmanStats>({ type: 'keep', gender });
export const resetStats = () => mutate<WingmanStats>({ type: 'reset' });
export const recordSession = () => mutate<WingmanStats>({ type: 'session' });
export const recordManualSkip = () => mutate<WingmanStats>({ type: 'manualSkip' });
export const recordPrototypeGirl = () => mutate<WingmanStats>({ type: 'prototypeGirl' });
export const recordPrototypeSkip = () => mutate<WingmanStats>({ type: 'prototypeSkip' });

export function onSettingsChanged(callback: (settings: WingmanSettings) => void) {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area === 'local' && SETTINGS_KEY in changes) callback(normalizeSettings(changes[SETTINGS_KEY].newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export function onStatsChanged(callback: (stats: WingmanStats) => void) {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area === 'local' && STATS_KEY in changes) callback(normalizeStats(changes[STATS_KEY].newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
