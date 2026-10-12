import { DIAGNOSTIC_LIMIT, idleDiagnostic, inspectPartnerFields, ownValue, type DiagnosticReport } from './diagnostic-report';

interface PartnerStore {
  getState(): unknown;
  subscribe(listener: () => void): () => void;
}

function partnerState(store: PartnerStore) {
  const state = store.getState();
  return ownValue(state, 'rouletteState');
}

export function findPartnerStore(document: Document): PartnerStore | null {
  const app = document.getElementById('app');
  if (!app) return null;
  const roots = Object.getOwnPropertyNames(app).filter(key => key.startsWith('__reactContainer$') || key === '_reactRootContainer');
  const queue: unknown[] = roots.map(key => ownValue(app, key));
  const seen = new Set<object>();
  // The Redux Provider sits near the React root. Do not scan the page or arbitrary globals.
  while (queue.length && seen.size < 80) {
    const fiber = queue.shift();
    if (!fiber || typeof fiber !== 'object' || seen.has(fiber)) continue;
    seen.add(fiber);
    const store = ownValue(ownValue(fiber, 'memoizedProps'), 'store') as PartnerStore | undefined;
    if (store && typeof store.getState === 'function' && typeof store.subscribe === 'function') {
      const roulette = partnerState(store);
      if (roulette && typeof roulette === 'object' && Object.hasOwn(roulette, 'interlocutor')) return store;
    }
    queue.push(ownValue(fiber, 'child'), ownValue(fiber, 'sibling'), ownValue(fiber, 'current'),
      ownValue(fiber, '_internalRoot'), ownValue(ownValue(fiber, 'stateNode'), 'current'));
  }
  return null;
}

export class PartnerMetadataProbe {
  private report = idleDiagnostic();
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private store: PartnerStore | null = null;
  private seen = new WeakSet<object>();
  private startedAt = 0;

  constructor(private document: Document, private publish: (report: DiagnosticReport) => void) {}

  start() {
    this.destroy();
    this.report = { ...idleDiagnostic(), state: 'waiting' };
    this.seen = new WeakSet();
    this.startedAt = Date.now();
    this.publish(this.report);
    this.timer = setInterval(() => this.check(), 500);
    this.check();
  }

  stop() {
    this.destroy();
    this.report = { ...this.report, state: this.report.checked ? 'complete' : 'idle' };
    this.publish(this.report);
  }

  destroy() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    try { this.unsubscribe?.(); } catch { /* A replaced page store may already be disposed. */ }
    this.unsubscribe = null;
    this.store = null;
  }

  private check() {
    try {
      if (Date.now() - this.startedAt >= 300000) { this.stop(); return; }
      const store = findPartnerStore(this.document);
      if (!store) {
        this.unsubscribe?.(); this.unsubscribe = null; this.store = null;
        if (Date.now() - this.startedAt >= 10000) this.unavailable();
        return;
      }
      if (this.store !== store) {
        this.unsubscribe?.();
        this.store = store;
        this.unsubscribe = store.subscribe(() => this.sample());
        this.report = { ...this.report, state: 'watching' };
        this.publish(this.report);
      }
      this.sample();
    } catch { this.unavailable(); }
  }

  private sample() {
    if (!this.store || this.timer === null) return;
    try {
      const roulette = partnerState(this.store);
      if (!['2', '3', '4', '5'].includes(String(ownValue(roulette, 'state')))) return;
      const partner = ownValue(roulette, 'interlocutor');
      if (!partner || typeof partner !== 'object' || Array.isArray(partner) || this.seen.has(partner)) return;
      this.seen.add(partner);
      const fields = inspectPartnerFields(partner);
      this.report = { state: 'watching', checked: this.report.checked + 1,
        withCandidate: this.report.withCandidate + (fields.length ? 1 : 0), fields: fields.length ? fields : this.report.fields };
      if (this.report.checked >= DIAGNOSTIC_LIMIT) {
        this.report.state = 'complete';
        this.destroy();
      }
      this.publish(this.report);
    } catch { this.unavailable(); }
  }

  private unavailable() {
    this.destroy();
    this.report = { ...this.report, state: 'unavailable', issue: 'store_unavailable' };
    this.publish(this.report);
  }
}
