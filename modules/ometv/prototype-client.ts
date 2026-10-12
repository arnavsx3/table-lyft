import { PROTOTYPE_CHANNEL, sanitizePrototype, type PrototypeSnapshot } from './prototype-data';

export class PrototypeClient {
  private pending: { id: string; resolve: (value: PrototypeSnapshot | null) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private listener = (event: MessageEvent) => {
    if (!this.pending || event.source !== window || event.origin !== location.origin ||
      event.data?.channel !== PROTOTYPE_CHANNEL || event.data.type !== 'SNAPSHOT' || event.data.requestId !== this.pending.id) return;
    const safe = sanitizePrototype(event.data.snapshot);
    if (safe) this.finish(safe);
  };

  constructor() { window.addEventListener('message', this.listener); }

  read(fingerprint: string): Promise<PrototypeSnapshot | null> {
    this.cancel();
    if (!/(^|\.)ome\.tv$/i.test(location.hostname)) return Promise.resolve(null);
    return new Promise(resolve => {
      const id = crypto.randomUUID();
      this.pending = { id, resolve, timer: setTimeout(() => this.finish(null), 1200) };
      window.postMessage({ channel: PROTOTYPE_CHANNEL, type: 'READ', requestId: id, fingerprint }, location.origin);
    });
  }

  cancel() { this.finish(null); }
  destroy() { this.cancel(); window.removeEventListener('message', this.listener); }
  private finish(value: PrototypeSnapshot | null) {
    if (!this.pending) return;
    const pending = this.pending; this.pending = null;
    clearTimeout(pending.timer); pending.resolve(value);
  }
}
