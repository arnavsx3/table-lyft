import { decide } from './decision';
import type { OmeAiVisionDetector } from './vision';
import type { OmeSkipper } from './skipper';
import type { PartnerSession } from './session';
import type { GenderType, PartnerDetectedEvent, RuntimeStatus, WingmanSettings } from '../types';

interface Dependencies {
  vision: Pick<OmeAiVisionDetector, 'load' | 'start' | 'stop' | 'destroy'>;
  skipper: Pick<OmeSkipper, 'skipPartner' | 'cancel' | 'playMatchSound' | 'destroy'>;
  isCurrent: (id: number) => boolean;
  recordSkip: (gender: GenderType) => Promise<unknown>;
  recordMatch: (gender: GenderType) => Promise<unknown>;
  onStatus: (status: RuntimeStatus) => void;
}

export class WingmanController {
  private session: PartnerSession | null = null;
  private generation = 0;
  private keptSession: number | null = null;
  private skippedSession: number | null = null;
  private manuallyHandled: number | null = null;
  private destroyed = false;

  constructor(private settings: WingmanSettings, private deps: Dependencies) {}

  public setSession(session: PartnerSession | null) {
    this.session = session;
    void this.refresh();
  }

  public updateSettings(settings: WingmanSettings) {
    const previous = this.settings;
    this.settings = settings;
    const keys: (keyof WingmanSettings)[] = ['enabled', 'targetGender', 'minimumConfidence', 'skipUnknown',
      'unknownTimeoutMs', 'skipDelayMinMs', 'skipDelayMaxMs'];
    if (keys.some(key => previous[key] !== settings[key])) void this.refresh();
  }

  public handleManualAction() {
    this.manuallyHandled = this.session?.id ?? null;
    this.generation++;
    this.deps.vision.stop();
    this.deps.skipper.cancel();
    this.status('waiting', 'Waiting for next connection');
  }

  public retry() { void this.refresh(); }

  private status(state: RuntimeStatus['state'], message: string) {
    if (!this.destroyed) this.deps.onStatus({ state, message });
  }

  private async refresh() {
    const generation = ++this.generation;
    this.deps.vision.stop();
    this.deps.skipper.cancel();
    if (this.destroyed) return;
    if (!this.settings.enabled || this.settings.targetGender === 'all') {
      this.status('paused', this.settings.enabled ? 'All connections allowed' : 'Filtering paused');
      return;
    }
    const session = this.session;
    if (!session || session.id === this.manuallyHandled || session.id === this.skippedSession) {
      this.status('waiting', 'Waiting for next connection');
      return;
    }
    const valid = () => !this.destroyed && generation === this.generation && this.deps.isCurrent(session.id);
    this.status('loading', 'Loading local models');
    try { await this.deps.vision.load(); }
    catch { if (valid()) this.status('model_error', 'Models unavailable. Retry detection.'); return; }
    if (!valid()) return;
    this.status('analyzing', 'Checking connection');
    let delivered = false;
    this.deps.vision.start(session, this.settings, valid,
      event => {
        if (delivered || !valid() || event.sessionId !== session.id) return;
        delivered = true;
        void this.handleDetection(event, valid);
      },
      () => { if (valid()) this.status('model_error', 'Video analysis failed. Retry detection.'); });
  }

  private async handleDetection(event: PartnerDetectedEvent, valid: () => boolean) {
    if (!valid() || event.sessionId !== this.session?.id) return;
    this.deps.vision.stop();
    const action = decide(event.gender, this.settings);
    if (action === 'wait') { this.status('uncertain', 'Uncertain match kept'); return; }
    if (action === 'keep') {
      this.status('keeping', 'Preferred match kept');
      if (this.keptSession === event.sessionId) return;
      this.keptSession = event.sessionId;
      try { await this.deps.recordMatch(event.gender); }
      catch { if (valid()) this.status('error', 'Match kept; statistics could not be saved'); }
      if (valid() && this.settings.soundAlertOnMatch) void this.deps.skipper.playMatchSound();
      return;
    }
    this.status('skipping', event.gender === 'unknown' ? 'Skipping uncertain match' : 'Skipping connection');
    try {
      const skipped = await this.deps.skipper.skipPartner(this.settings, valid);
      if (!skipped) {
        if (valid()) this.status('skip_unavailable', 'Next control unavailable. Retry or skip manually.');
        return;
      }
      // The click can synchronously change the connection; count the dispatched action once.
      this.skippedSession = event.sessionId;
      await this.deps.recordSkip(event.gender);
      if (valid()) this.status('waiting', 'Next requested; waiting for connection');
    } catch {
      if (valid()) this.status('error', 'Skip could not be completed or recorded');
    }
  }

  public destroy() {
    this.destroyed = true;
    this.generation++;
    this.deps.vision.destroy();
    this.deps.skipper.destroy();
  }
}
