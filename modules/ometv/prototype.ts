import type { WingmanSettings } from '../types';
import type { PartnerSession } from './session';
import type { PrototypeSnapshot } from './prototype-data';

interface Dependencies {
  read: (fingerprint: string) => Promise<PrototypeSnapshot | null>;
  cancelRead: () => void;
  current: () => PartnerSession | null;
  isCurrent: (id: number) => boolean;
  canSkip: () => boolean;
  next: () => boolean;
  confirmTransition: () => void;
  recordGirl: () => Promise<unknown>;
  onGirl?: () => void;
  onMessage: (message?: string) => void;
}

export class MetadataPrototype {
  private settings: WingmanSettings;
  private timer: ReturnType<typeof setInterval> | null = null;
  private revision = 0;
  private busy = false;
  private lastClick = -Infinity;
  private pair: { token: number; sessionId: number; code: 1 | 2 | null; since: number; delay: number; handled: boolean; blocked: boolean; error?: string } | null = null;
  private suppressed: { sessionId: number; token?: number } | null = null;

  constructor(settings: WingmanSettings, private deps: Dependencies) { this.settings = settings; }

  update(settings: WingmanSettings) {
    this.settings = settings;
    this.revision++;
    this.deps.cancelRead();
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.pair) this.pair.since = Date.now();
    if (!settings.enabled || !settings.experimentalAutoSkip) { this.deps.onMessage(); return; }
    this.timer = setInterval(() => { void this.tick(); }, 250);
    void this.tick();
  }

  stopCurrent() {
    const session = this.deps.current();
    if (session) this.suppressed = { sessionId: session.id,
      token: this.pair?.sessionId === session.id ? this.pair.token : undefined };
    if (this.pair) this.pair.blocked = true;
    this.revision++; this.deps.cancelRead();
  }

  private async tick() {
    if (this.busy || this.timer === null) return;
    const session = this.deps.current();
    if (!session) { this.deps.onMessage(); return; }
    this.busy = true;
    const revision = this.revision;
    try {
      const data = await this.deps.read(session.fingerprint);
      if (revision !== this.revision || this.timer === null || !this.deps.isCurrent(session.id)) return;
      if (!data || data.state !== 'connected') {
        if (this.pair) this.pair.since = Date.now();
        this.deps.onMessage(!data || data.state === 'unavailable' ? 'Partner data unavailable - leaving connection unchanged' : 'Waiting for established partner data');
        return;
      }
      if (!this.pair || data.token > this.pair.token) {
        if (this.pair) this.deps.confirmTransition();
        this.pair = { token: data.token, sessionId: session.id, code: data.code, since: Date.now(), handled: false, blocked: false,
          delay: Math.max(500, this.settings.skipDelayMinMs + Math.floor(Math.random() * (this.settings.skipDelayMaxMs - this.settings.skipDelayMinMs + 1))) };
      }
      const pair = this.pair;
      if (data.token !== pair.token) return;
      if (this.suppressed?.sessionId === session.id &&
        (this.suppressed.token === undefined || this.suppressed.token === data.token)) pair.blocked = true;
      else this.suppressed = null;
      if (pair.code === null && data.code !== null) { pair.code = data.code; pair.since = Date.now(); }
      else if (pair.code !== data.code) pair.blocked = true;
      if (pair.blocked) { this.deps.onMessage('Partner data changed - leaving connection unchanged'); return; }
      if (pair.code === null) { pair.since = Date.now(); this.deps.onMessage('Unknown gender code - leaving connection unchanged'); return; }
      if (pair.error) { this.deps.onMessage(pair.error); return; }
      this.deps.onMessage(pair.code === 2 ? 'Female code (2) - experimental mapping' : 'Male/couple code (1) - experimental mapping');
      if (pair.handled || Date.now() - pair.since < (pair.code === 2 ? 500 : pair.delay) || !this.deps.canSkip()) return;
      if (pair.code === 2) {
        pair.handled = true;
        try {
          await this.deps.recordGirl();
          if (revision === this.revision && this.timer !== null && this.deps.isCurrent(session.id)) this.deps.onGirl?.();
        }
        catch { pair.error = 'Could not save prototype counter'; this.deps.onMessage(pair.error); }
      } else if (Date.now() - this.lastClick >= 1000) {
        // Every tick gets a fresh snapshot; never use the diagnostic's retained field list.
        pair.handled = true;
        if (this.deps.next()) this.lastClick = Date.now();
        else { pair.error = 'Automatic Next unavailable - use Next to retry'; this.deps.onMessage(pair.error); }
      }
    } finally { this.busy = false; }
  }

  destroy() {
    this.revision++;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.deps.cancelRead();
  }
}
