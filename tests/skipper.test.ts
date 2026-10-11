import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findNextButton, OmeSkipper } from '../modules/ometv/skipper';
import { DEFAULT_SETTINGS } from '../modules/preferences';

const settings = { ...DEFAULT_SETTINGS, skipDelayMinMs: 300, skipDelayMaxMs: 300 };

describe('skip actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button class="next">Next</button>';
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  });
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('clicks exactly once and never retries against a later partner', async () => {
    const click = vi.fn();
    document.querySelector('button')!.addEventListener('click', click);
    const skipper = new OmeSkipper();
    const result = skipper.skipPartner(settings, () => true);
    await vi.advanceTimersByTimeAsync(300);
    expect(await result).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(click).toHaveBeenCalledTimes(1);
    skipper.destroy();
  });

  it('cancels an in-flight delay immediately', async () => {
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const skipper = new OmeSkipper();
    const result = skipper.skipPartner(settings, () => true);
    skipper.cancel();
    expect(await result).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(click).not.toHaveBeenCalled();
  });

  it('rechecks connection identity at execution time', async () => {
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    let current = true;
    const result = new OmeSkipper().skipPartner(settings, () => current);
    current = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(await result).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });

  it('does not click disabled, hidden, or unrelated controls', async () => {
    document.body.innerHTML = '<button class="next" disabled>Next</button><button class="next" style="display:none">Next</button><button class="btn btn-main">Start</button><div class="controls"><button>Stop</button></div>';
    expect(findNextButton()).toBeNull();
    const keyboard = vi.fn();
    window.addEventListener('keydown', keyboard);
    const result = new OmeSkipper().skipPartner(settings, () => true);
    await vi.advanceTimersByTimeAsync(300);
    expect(await result).toBe(false);
    expect(keyboard).not.toHaveBeenCalled();
    window.removeEventListener('keydown', keyboard);
  });

  it('respects OmeTV parent disabled classes and localized Next labels', () => {
    document.body.innerHTML = '<div class="start-button disabled"><div class="btn btn-main"><span data-tr="next">Suivant</span></div></div>';
    expect(findNextButton()).toBeNull();
    document.querySelector('.start-button')!.classList.remove('disabled');
    expect(findNextButton()).toBe(document.querySelector('.btn-main'));
  });

  it('enforces a cooldown between dispatched actions', async () => {
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const skipper = new OmeSkipper();
    const first = skipper.skipPartner(settings, () => true);
    await vi.advanceTimersByTimeAsync(300);
    await first;
    const second = skipper.skipPartner(settings, () => true);
    await vi.advanceTimersByTimeAsync(999);
    expect(click).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toBe(true);
    expect(click).toHaveBeenCalledTimes(2);
  });
});
