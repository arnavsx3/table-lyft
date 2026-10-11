import { OMETV_SELECTORS } from './constants';
import type { WingmanSettings } from '../types';

export class OmeSkipper {
  private isSkipping = false;
  private lastSkipTime = 0;
  private audioCtx: AudioContext | null = null;

  constructor() {}

  /**
   * Performs an anti-detection humanized skip with randomized delay
   * Automatically queues or waits for safety cooldown instead of dropping
   */
  public async skipPartner(settings: WingmanSettings, onSkipTriggered?: () => void): Promise<boolean> {
    if (this.isSkipping) return false;
    this.isSkipping = true;

    try {
      const now = Date.now();
      // Ensure at least 450ms between skips to satisfy OmeTV rate limiters
      const elapsedSinceLast = now - this.lastSkipTime;
      if (elapsedSinceLast < 450) {
        await new Promise((resolve) => setTimeout(resolve, 450 - elapsedSinceLast));
      }

      // Calculate randomized jitter delay to simulate human reaction time
      const minDelay = Math.max(120, settings.skipDelayMinMs);
      const maxDelay = Math.max(minDelay, settings.skipDelayMaxMs);
      const jitter = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      await new Promise((resolve) => setTimeout(resolve, jitter));

      const executed = this.executeSkipAction();
      if (executed) {
        this.lastSkipTime = Date.now();
        onSkipTriggered?.();

        // Anti-hang safety retry: if still on the same video after 600ms, re-trigger
        setTimeout(() => {
          const wrapper = document.querySelector('#remote-video-wrapper');
          if (wrapper?.classList.contains('s-play')) {
            const nextBtn = this.findNextButton();
            if (nextBtn) {
              console.log('[Wingman Skipper] Anti-hang retry: re-clicking Next button...');
              nextBtn.click();
            }
          }
        }, 600);
      }
      return executed;
    } finally {
      this.isSkipping = false;
    }
  }

  /**
   * Executes the skip action using direct click + simulated pointer events
   */
  private executeSkipAction(): boolean {
    const nextBtn = this.findNextButton();
    if (nextBtn) {
      this.simulateHumanClick(nextBtn);
      // Also invoke direct click as guaranteed fallback
      try {
        nextBtn.click();
      } catch {}
      return true;
    }

    // Fallback: keyboard shortcut
    return this.simulateKeyPress('ArrowRight', 39);
  }

  private findNextButton(): HTMLElement | null {
    // 1. Direct confirmed OmeTV button selector
    const directBtn = document.querySelector('.btn.btn-main .btn__bg, .btn.btn-main') as HTMLElement | null;
    if (directBtn && this.isElementVisible(directBtn)) {
      return directBtn;
    }

    // 2. Query known selectors
    for (const selector of OMETV_SELECTORS.nextButton) {
      const el = document.querySelector(selector) as HTMLElement;
      if (el && this.isElementVisible(el)) {
        return el;
      }
    }

    // 3. Fallback: search buttons for text like "Next"
    const buttons = document.querySelectorAll('button, div[role="button"], .btn');
    for (const btn of Array.from(buttons)) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes('next') && this.isElementVisible(btn as HTMLElement)) {
        return btn as HTMLElement;
      }
    }

    return null;
  }

  private isElementVisible(el: HTMLElement): boolean {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  private simulateHumanClick(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() * 4 - 2);
    const y = rect.top + rect.height / 2 + (Math.random() * 4 - 2);

    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    };

    element.dispatchEvent(new PointerEvent('pointerdown', eventInit));
    element.dispatchEvent(new MouseEvent('mousedown', eventInit));
    element.dispatchEvent(new PointerEvent('pointerup', eventInit));
    element.dispatchEvent(new MouseEvent('mouseup', eventInit));
  }

  private simulateKeyPress(key: string, keyCode: number): boolean {
    const eventInit: KeyboardEventInit = {
      key,
      code: key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    };

    const target = document.activeElement || document.body;
    const down = target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    const up = target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    return down && up;
  }

  /**
   * Play a pleasant synthesized chime via Web Audio API on target match
   */
  public playMatchSound() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.3);
    } catch {
      // Audio might be blocked if user hasn't interacted yet
    }
  }
}
