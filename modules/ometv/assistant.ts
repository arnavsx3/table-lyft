import type { RuntimeStatus } from '../types';
import type { PartnerSession } from './session';

interface AssistantDependencies {
  clickNext: () => boolean;
  recordSession: () => Promise<unknown>;
  recordSkip: () => Promise<unknown>;
  recordAutoSkip?: () => Promise<unknown>;
  onStatus: (status: RuntimeStatus) => void;
  onConnection?: () => void;
}

export class SessionAssistant {
  private session: PartnerSession | null = null;
  private connectedAt: number | undefined;
  private countedSession: number | null = null;
  private pending: { sessionId: number; automatic: boolean; timer: ReturnType<typeof setTimeout> } | null = null;
  private destroyed = false;

  constructor(private enabled: boolean, private deps: AssistantDependencies) {}

  public setSession(session: PartnerSession | null) {
    if (this.destroyed) return;
    const previous = this.session;
    if (previous?.id === session?.id) return;
    this.session = session;
    this.connectedAt = session ? Date.now() : undefined;
    if (previous && this.pending?.sessionId === previous.id) {
      const automatic = this.pending.automatic;
      this.cancelPending();
      this.persist(automatic && this.deps.recordAutoSkip ? this.deps.recordAutoSkip() : this.deps.recordSkip());
    }
    this.countConnection();
    this.publish();
  }

  public setEnabled(enabled: boolean) {
    if (this.destroyed) return;
    this.enabled = enabled;
    if (!enabled) this.cancelPending();
    this.countConnection();
    this.publish();
  }

  private countConnection() {
    if (!this.enabled || !this.session || this.countedSession === this.session.id) return;
    this.countedSession = this.session.id;
    this.persist(this.deps.recordSession());
    this.deps.onConnection?.();
  }

  // A click is an intent, not a skip. Count it only after the connection changes.
  public observeNext(automatic = false): boolean {
    if (this.destroyed || !this.enabled || !this.session || this.pending) return false;
    this.pending = { sessionId: this.session.id, automatic, timer: setTimeout(() => {
      this.pending = null;
      this.publish('Next did not change the connection. Try again.');
    }, 3000) };
    this.publish();
    return true;
  }

  public next(automatic = false): boolean {
    if (!this.observeNext(automatic)) return false;
    try {
      if (this.deps.clickNext()) return true;
      this.cancelPending();
      this.publish('Next control unavailable');
    } catch {
      this.cancelPending();
      this.publish('Could not request the next connection');
    }
    return false;
  }

  public confirmAutomaticTransition() {
    if (this.destroyed || !this.pending?.automatic) return;
    this.cancelPending();
    if (this.deps.recordAutoSkip) this.persist(this.deps.recordAutoSkip());
    this.publish();
  }

  public cancelAutomatic() { if (this.pending?.automatic) { this.cancelPending(); this.publish(); } }

  public stop() { this.cancelPending(); this.publish(); }
  public retry() { if (!this.destroyed) this.publish(); }

  private persist(operation: Promise<unknown>) {
    void operation.catch(() => {
      if (!this.destroyed) this.publish('Could not save counters. Check extension access.');
    });
  }

  private publish(error?: string) {
    if (this.destroyed) return;
    const state = error ? 'error' : !this.enabled ? 'paused' : this.pending ? 'skip_pending' : this.session ? 'connected' : 'waiting';
    this.deps.onStatus({ state, message: error ?? (!this.enabled ? 'Session tracking paused' : this.pending
      ? 'Requesting next connection' : this.session ? 'Connected' : 'Waiting for next connection'),
      connectedAt: this.connectedAt, canSkip: this.enabled && !!this.session && !this.pending });
  }

  private cancelPending() {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
  }

  public destroy() { this.destroyed = true; this.cancelPending(); }
}
