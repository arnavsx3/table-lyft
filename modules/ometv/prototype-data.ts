import { ownValue } from './diagnostic-report';
import { findPartnerStore } from './metadata-probe';
import { remoteVideoSnapshot } from './session';

export const PROTOTYPE_CHANNEL = 'wingman-partner-prototype-v1';
export interface PrototypeSnapshot {
  state: 'connected' | 'waiting' | 'unavailable';
  token: number;
  code: 1 | 2 | null;
}

export function sanitizePrototype(value: unknown): PrototypeSnapshot | null {
  const state = ownValue(value, 'state'), token = ownValue(value, 'token'), code = ownValue(value, 'code');
  if (!['connected', 'waiting', 'unavailable'].includes(String(state)) || typeof token !== 'number' ||
    !Number.isSafeInteger(token) || token < 0 || (code !== null && code !== 1 && code !== 2)) return null;
  if (state !== 'connected' && code !== null) return null;
  if (state === 'connected' && token === 0) return null;
  return { state: state as PrototypeSnapshot['state'], token, code };
}

// Pair IDs never cross the bridge or enter storage. Only a tab-local sequence is returned.
export class PrototypePartnerReader {
  private pair: unknown;
  private store: unknown;
  private token = 0;
  private fingerprint: string | undefined;

  constructor(private document: Document) {}

  read(fingerprint: string): PrototypeSnapshot {
    const result = (state: PrototypeSnapshot['state'], code: 1 | 2 | null = null): PrototypeSnapshot => ({ state, token: this.token, code });
    try {
      const store = findPartnerStore(this.document);
      if (this.store !== store) { this.store = store; this.pair = undefined; }
      if (!store) return result('unavailable');
      const roulette = ownValue(store.getState(), 'rouletteState');
      const stage = ownValue(roulette, 'state');
      const partner = ownValue(roulette, 'interlocutor');
      const pair = ownValue(partner, 'PairId');
      if ((typeof pair !== 'string' || !pair.length || pair.length > 128) &&
        (typeof pair !== 'number' || !Number.isSafeInteger(pair))) { this.pair = undefined; return result('waiting'); }
      if (stage === '0' || stage === '1' || stage === 0 || stage === 1) { this.pair = undefined; return result('waiting'); }
      if (this.pair !== pair) { this.pair = pair; this.token++; this.fingerprint = undefined; }
      // Found/reconnecting is not an established remote connection.
      if (stage !== '3' && stage !== 3) return result('waiting');
      const media = remoteVideoSnapshot(this.document);
      if (!media || media.fingerprint !== fingerprint) return result('waiting');
      if (this.fingerprint && this.fingerprint !== fingerprint) return result('waiting');
      this.fingerprint = fingerprint;
      const code = ownValue(partner, 'Gender');
      return result('connected', code === 1 || code === 2 ? code : null);
    } catch { this.pair = undefined; return result('unavailable'); }
  }
}
