export type TargetGender = 'girls_only' | 'boys_only' | 'all';
export type GenderType = 'male' | 'female' | 'unknown';

export interface WingmanSettings {
  enabled: boolean;
  targetGender: TargetGender;
  skipDelayMinMs: number;
  skipDelayMaxMs: number;
  showInPageHud: boolean;
  soundAlertOnMatch: boolean;
  minimumConfidence: number;
  skipUnknown: boolean;
  unknownTimeoutMs: number;
}

export interface WingmanStats {
  totalSessions: number;
  totalSkipped: number;
  totalKept: number;
  malesSkipped: number;
  femalesMatched: number;
  unknownSkipped: number;
  sessionStartedAt: number;
}

export interface PartnerDetectedEvent {
  sessionId: number;
  gender: GenderType;
  confidence?: number;
  reason?: 'timeout';
}

export type RuntimeState = 'connected' | 'skip_pending' | 'paused' | 'waiting' | 'loading' | 'analyzing' | 'keeping'
  | 'skipping' | 'uncertain' | 'skip_unavailable' | 'model_error' | 'error';

export interface RuntimeStatus {
  state: RuntimeState;
  message: string;
  connectedAt?: number;
  canSkip?: boolean;
}
