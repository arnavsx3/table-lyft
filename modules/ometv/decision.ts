import type { GenderType, WingmanSettings } from '../types';

export function decide(gender: GenderType, settings: WingmanSettings): 'skip' | 'keep' | 'wait' {
  if (!settings.enabled || settings.targetGender === 'all') return 'wait';
  if (gender === 'unknown') return settings.skipUnknown ? 'skip' : 'wait';
  const target = settings.targetGender === 'girls_only' ? 'female' : 'male';
  return gender === target ? 'keep' : 'skip';
}

export class DetectionConsensus {
  private gender: GenderType = 'unknown';
  private count = 0;

  public add(gender: GenderType, confidence: number, threshold: number): GenderType | null {
    if (gender === 'unknown' || !Number.isFinite(confidence) || confidence < threshold) {
      this.reset();
      return null;
    }
    if (this.gender === gender) this.count++;
    else { this.gender = gender; this.count = 1; }
    return this.count >= 3 ? gender : null;
  }

  public reset() { this.gender = 'unknown'; this.count = 0; }
}
