import { WingmanSettings, WingmanStats } from './types';

export const DEFAULT_SETTINGS: WingmanSettings = {
  enabled: true,
  targetGender: 'girls_only',
  skipDelayMinMs: 300,
  skipDelayMaxMs: 650,
  showInPageHud: true,
  autoReconnectOnDisconnect: true,
  soundAlertOnMatch: true,
};

export const DEFAULT_STATS: WingmanStats = {
  totalSkipped: 0,
  totalKept: 0,
  malesSkipped: 0,
  femalesMatched: 0,
  sessionStartedAt: Date.now(),
};

const SETTINGS_KEY = 'wingman_settings';
const STATS_KEY = 'wingman_stats';

export async function getSettings(): Promise<WingmanSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
}

export async function saveSettings(settings: Partial<WingmanSettings>): Promise<WingmanSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}

export async function getStats(): Promise<WingmanStats> {
  const result = await chrome.storage.local.get(STATS_KEY);
  return { ...DEFAULT_STATS, ...(result[STATS_KEY] || {}) };
}

export async function recordSkip(isMale: boolean): Promise<WingmanStats> {
  const current = await getStats();
  const updated: WingmanStats = {
    ...current,
    totalSkipped: current.totalSkipped + 1,
    malesSkipped: isMale ? current.malesSkipped + 1 : current.malesSkipped,
  };
  await chrome.storage.local.set({ [STATS_KEY]: updated });
  return updated;
}

export async function recordMatch(isFemale: boolean): Promise<WingmanStats> {
  const current = await getStats();
  const updated: WingmanStats = {
    ...current,
    totalKept: current.totalKept + 1,
    femalesMatched: isFemale ? current.femalesMatched + 1 : current.femalesMatched,
  };
  await chrome.storage.local.set({ [STATS_KEY]: updated });
  return updated;
}

export async function resetStats(): Promise<WingmanStats> {
  const fresh: WingmanStats = {
    ...DEFAULT_STATS,
    sessionStartedAt: Date.now(),
  };
  await chrome.storage.local.set({ [STATS_KEY]: fresh });
  return fresh;
}

export function onSettingsChanged(callback: (settings: WingmanSettings) => void) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) {
      callback({ ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue });
    }
  });
}

export function onStatsChanged(callback: (stats: WingmanStats) => void) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STATS_KEY]) {
      callback({ ...DEFAULT_STATS, ...changes[STATS_KEY].newValue });
    }
  });
}
