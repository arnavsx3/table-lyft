import type { WingmanSettings, WingmanStats } from './types';

export const DEFAULT_SETTINGS: WingmanSettings = {
  enabled: true,
  experimentalAutoSkip: false,
  targetGender: 'girls_only',
  skipDelayMinMs: 300,
  skipDelayMaxMs: 650,
  showInPageHud: true,
  soundAlertOnMatch: true,
  minimumConfidence: 0.85,
  skipUnknown: false,
  unknownTimeoutMs: 8000,
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function number(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}

export function normalizeSettings(value: unknown): WingmanSettings {
  const input = object(value);
  const defaults = DEFAULT_SETTINGS;
  const min = Math.round(number(input.skipDelayMinMs, defaults.skipDelayMinMs, 150, 5000));
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : defaults.enabled,
    // Withdraw the numeric mapping even for profiles that enabled the 1.3.0 prototype.
    experimentalAutoSkip: false,
    targetGender: ['girls_only', 'boys_only', 'all'].includes(String(input.targetGender))
      ? input.targetGender as WingmanSettings['targetGender'] : defaults.targetGender,
    skipDelayMinMs: min,
    skipDelayMaxMs: Math.max(min, Math.round(number(input.skipDelayMaxMs, defaults.skipDelayMaxMs, 150, 5000))),
    showInPageHud: typeof input.showInPageHud === 'boolean' ? input.showInPageHud : defaults.showInPageHud,
    soundAlertOnMatch: typeof input.soundAlertOnMatch === 'boolean' ? input.soundAlertOnMatch : defaults.soundAlertOnMatch,
    minimumConfidence: number(input.minimumConfidence, defaults.minimumConfidence, 0.7, 0.99),
    skipUnknown: typeof input.skipUnknown === 'boolean' ? input.skipUnknown : defaults.skipUnknown,
    unknownTimeoutMs: Math.round(number(input.unknownTimeoutMs, defaults.unknownTimeoutMs, 3000, 30000)),
  };
}

export function freshStats(now = Date.now()): WingmanStats {
  return { totalSessions: 0, totalSkipped: 0, totalKept: 0, malesSkipped: 0, femalesMatched: 0, unknownSkipped: 0,
    girlsConnected: 0, maleCoupleSkipped: 0, sessionStartedAt: now };
}

export function normalizeStats(value: unknown): WingmanStats {
  const input = object(value);
  const fresh = freshStats();
  for (const key of Object.keys(fresh) as (keyof WingmanStats)[]) {
    fresh[key] = Math.floor(number(input[key], fresh[key], 0, Number.MAX_SAFE_INTEGER));
  }
  return fresh;
}
