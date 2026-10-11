export type TargetGender = 'girls_only' | 'boys_only' | 'all';

export interface WingmanSettings {
  enabled: boolean;
  targetGender: TargetGender;
  skipDelayMinMs: number; // e.g. 300ms
  skipDelayMaxMs: number; // e.g. 700ms
  showInPageHud: boolean;
  autoReconnectOnDisconnect: boolean;
  soundAlertOnMatch: boolean;
}

export interface WingmanStats {
  totalSkipped: number;
  totalKept: number;
  malesSkipped: number;
  femalesMatched: number;
  sessionStartedAt: number;
}

export type GenderType = 'male' | 'female' | 'unknown';

export interface PartnerDetectedEvent {
  gender: GenderType;
  country?: string;
  source: 'websocket' | 'dom';
  raw?: any;
}
