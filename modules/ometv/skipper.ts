import { OMETV_SELECTORS } from './constants';
import { WingmanSettings } from '../types';

export class OmeSkipper {
  private isSkipping = false;
  private lastSkipTime = 0;
  private audioCtx: AudioContext | null = null;

  constructor() {}

  /**
   * Performs an anti-detection humanized skip with randomized delay
   */
  public async skipPartner(settings: WingmanSettings, onSkipTriggered?: () => void): Promise<boolean> {
    const now = Date.now();
    // Safety cooldown of 800ms between skip actions to avoid spamming
    if (this.isSkipping || now - this.lastSkipTime < 800) {
      return false;
    }

    this.isSkipping = true;

    // Calculate randomized jitter delay to simulate human reaction time
    const minDelay = Math.max(150, settings.skipDelayMinMs);
    const maxDelay = Math.max(minDelay, settings.skipDelayMaxMs);
    const jitter = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    await new Promise((resolve) => setTimeout(resolve, jitter));

    try {
      const executed = this.executeSkipAction();
      if (executed) {
        this.lastSkipTime = Date.now();
        onSkipTriggered?.();
      }
      return executed;
    } finally {
      this.isSkipping = false;
    }
  }

  /**
   * Executes the skip action using DOM clicks and keyboard shortcuts
   */
  private executeSkipAction(): boolean {
    // 1. Try DOM button click
    const nextBtn = this.findNextButton();
    if (nextBtn) {
      this.simulateHumanClick(nextBtn);
      return true;
    }

    // 2. Fallback: Simulate Right Arrow keypress (standard OmeTV shortcut)
    return this.simulateKeyPress('ArrowRight', 39);
  }

  private findNextButton(): HTMLElement | null {
    // Query known selectors
    for (const selector of OMETV_SELECTORS.nextButton) {
      const el = document.querySelector(selector) as HTMLElement;
      if (el && this.isElementVisible(el)) {
        return el;
      }
    }

    // Fallback: search all buttons for text like "Next" or "Skip"
    const buttons = document.querySelectorAll('button, div[role="button"]');
    for (const btn of Array.from(buttons)) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if ((text.includes('next') || text.includes('skip')) && this.isElementVisible(btn as HTMLElement)) {
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
    element.click();
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
