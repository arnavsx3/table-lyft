import { NEXT_SELECTORS } from './constants';
import type { WingmanSettings } from '../types';

export function isActionable(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return element.isConnected && !element.closest('[inert], [aria-disabled="true"], [disabled], .disabled, .is-disabled')
    && style.visibility !== 'hidden' && style.display !== 'none' && style.pointerEvents !== 'none'
    && !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

export function findNextButton(): HTMLElement | null {
  for (const selector of NEXT_SELECTORS) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      // OmeTV reuses its main control for Start. Only click an actual Next control.
      if (selector === '.btn.btn-main' && !/^(next|skip)$/i.test((element.textContent ?? '').trim())
        && !/^(next|skip)$/i.test(element.getAttribute('aria-label') ?? '')
        && !element.querySelector('[data-tr="next"], [data-tr="skip"]')) continue;
      if (isActionable(element)) return element;
    }
  }
  return Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
    .find(element => /^(next|skip)$/i.test((element.textContent ?? '').trim()) && isActionable(element)) ?? null;
}

function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const abort = () => { clearTimeout(timer); resolve(false); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(true); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export class OmeSkipper {
  private pending: AbortController | null = null;
  private lastSkipTime = -Infinity;
  private audioCtx: AudioContext | null = null;

  public async skipPartner(settings: WingmanSettings, isCurrent: () => boolean): Promise<boolean> {
    this.cancel();
    const pending = new AbortController();
    this.pending = pending;
    const jitter = settings.skipDelayMinMs + Math.floor(Math.random() * (settings.skipDelayMaxMs - settings.skipDelayMinMs + 1));
    const delay = Math.max(jitter, 1000 - (Date.now() - this.lastSkipTime));
    try {
      if (!await wait(delay, pending.signal) || !isCurrent()) return false;
      const button = findNextButton();
      if (!button || pending.signal.aborted || !isCurrent()) return false;
      button.click();
      this.lastSkipTime = Date.now();
      return true;
    } finally {
      if (this.pending === pending) this.pending = null;
    }
  }

  public cancel() { this.pending?.abort(); this.pending = null; }

  public async playMatchSound() {
    try {
      this.audioCtx ??= new AudioContext();
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
      if (this.audioCtx.state !== 'running') return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.3);
    } catch { /* Browser audio policy may require a user gesture. */ }
  }

  public destroy() {
    this.cancel();
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
  }
}
