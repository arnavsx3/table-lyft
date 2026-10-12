import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetadataPrototype } from '../modules/ometv/prototype';
import { DEFAULT_SETTINGS } from '../modules/preferences';
import type { PrototypeSnapshot } from '../modules/ometv/prototype-data';
import type { PartnerSession } from '../modules/ometv/session';

function setup() {
  let session: PartnerSession | null = { id: 1, fingerprint: 'stream', video: document.createElement('video') };
  let snapshot: PrototypeSnapshot | null = { state: 'connected', token: 1, code: 1 };
  const settings = { ...DEFAULT_SETTINGS, experimentalAutoSkip: true, skipDelayMinMs: 500, skipDelayMaxMs: 500 };
  const deps = { read: vi.fn(async () => snapshot), cancelRead: vi.fn(), current: () => session,
    isCurrent: (id: number) => session?.id === id, canSkip: vi.fn(() => true), next: vi.fn(() => true),
    confirmTransition: vi.fn(), recordGirl: vi.fn(async () => {}), onMessage: vi.fn(), onGirl: vi.fn() };
  const prototype = new MetadataPrototype(settings, deps);
  return { prototype, deps, settings, data: (data: PrototypeSnapshot | null) => { snapshot = data; },
    session: (value: PartnerSession | null) => { session = value; } };
}

describe('metadata-only experimental prototype', () => {
  const instances: MetadataPrototype[] = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { instances.forEach(instance => instance.destroy()); instances.length = 0; vi.useRealTimers(); });
  const create = () => { const test = setup(); instances.push(test.prototype); return test; };

  it('is off by default and pauses without issuing reads or actions', async () => {
    const test = create(); test.prototype.update(DEFAULT_SETTINGS); await vi.advanceTimersByTimeAsync(2000);
    expect(test.deps.read).not.toHaveBeenCalled();
    test.prototype.update(test.settings); await vi.advanceTimersByTimeAsync(250);
    test.prototype.update({ ...test.settings, enabled: false }); await vi.advanceTimersByTimeAsync(2000);
    expect(test.deps.next).not.toHaveBeenCalled(); expect(test.deps.recordGirl).not.toHaveBeenCalled();
  });

  it('requests one automatic Next for code 1 after a stable delay, without recording a click as a successful skip', async () => {
    const test = create(); test.prototype.update(test.settings); await vi.advanceTimersByTimeAsync(250);
    expect(test.deps.next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000); expect(test.deps.next).toHaveBeenCalledTimes(1);
    expect(test.deps.recordGirl).not.toHaveBeenCalled(); expect(test.deps.confirmTransition).not.toHaveBeenCalled();
    test.data({ state: 'connected', token: 2, code: 2 }); await vi.advanceTimersByTimeAsync(1000);
    expect(test.deps.confirmTransition).toHaveBeenCalledTimes(1); expect(test.deps.recordGirl).toHaveBeenCalledTimes(1);
  });

  it('counts code 2 once per pair across repeated objects, pause/resume and replaced video sessions', async () => {
    const test = create(); test.data({ state: 'connected', token: 1, code: 2 }); test.prototype.update(test.settings);
    await vi.advanceTimersByTimeAsync(2000); expect(test.deps.recordGirl).toHaveBeenCalledTimes(1);
    test.prototype.update({ ...test.settings, enabled: false }); test.prototype.update(test.settings);
    test.session({ id: 2, fingerprint: 'replacement', video: document.createElement('video') });
    await vi.advanceTimersByTimeAsync(2000); expect(test.deps.recordGirl).toHaveBeenCalledTimes(1);
    expect(test.deps.next).not.toHaveBeenCalled();
  });

  it('leaves unknown, unavailable and waiting data untouched', async () => {
    const test = create(); test.data(null); test.prototype.update(test.settings);
    for (const data of [null, { state: 'unavailable', token: 0, code: null }, { state: 'waiting', token: 1, code: null },
      { state: 'connected', token: 1, code: null }] as const) { test.data(data); await vi.advanceTimersByTimeAsync(2000); }
    expect(test.deps.next).not.toHaveBeenCalled(); expect(test.deps.recordGirl).not.toHaveBeenCalled();
    test.data({ state: 'connected', token: 1, code: 2 }); await vi.advanceTimersByTimeAsync(1000);
    expect(test.deps.recordGirl).toHaveBeenCalledTimes(1);
  });

  it('cancels stale delayed decisions when the pair changes or metadata conflicts', async () => {
    const test = create(); test.prototype.update(test.settings); await vi.advanceTimersByTimeAsync(250);
    test.data({ state: 'connected', token: 2, code: 2 }); await vi.advanceTimersByTimeAsync(1000);
    expect(test.deps.next).not.toHaveBeenCalled(); expect(test.deps.recordGirl).toHaveBeenCalledTimes(1);
    test.data({ state: 'connected', token: 3, code: 1 }); await vi.advanceTimersByTimeAsync(250);
    test.data({ state: 'connected', token: 3, code: 2 }); await vi.advanceTimersByTimeAsync(1000);
    expect(test.deps.next).not.toHaveBeenCalled(); expect(test.deps.recordGirl).toHaveBeenCalledTimes(1);
    expect(test.deps.onMessage).toHaveBeenLastCalledWith('Partner data changed - leaving connection unchanged');
  });

  it('drops in-flight reads after pause, Stop, a stream transition or teardown', async () => {
    for (const cancel of ['pause', 'stop', 'stream', 'destroy']) {
      const test = create(); let resolve!: (data: PrototypeSnapshot) => void;
      test.deps.read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
      test.prototype.update(test.settings);
      if (cancel === 'pause') test.prototype.update({ ...test.settings, enabled: false });
      if (cancel === 'stop') test.prototype.stopCurrent();
      if (cancel === 'stream') test.session(null);
      if (cancel === 'destroy') test.prototype.destroy();
      resolve({ state: 'connected', token: 1, code: 1 }); await Promise.resolve();
      expect(test.deps.next).not.toHaveBeenCalled(); expect(test.deps.recordGirl).not.toHaveBeenCalled();
      test.prototype.destroy();
    }
  });

  it('does not retry-click failed Next controls or compete with a pending manual request', async () => {
    const test = create(); test.deps.canSkip.mockReturnValue(false); test.prototype.update(test.settings);
    await vi.advanceTimersByTimeAsync(2000); expect(test.deps.next).not.toHaveBeenCalled();
    test.deps.canSkip.mockReturnValue(true); test.deps.next.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(3000); expect(test.deps.next).toHaveBeenCalledTimes(1);
    expect(test.deps.onMessage).toHaveBeenLastCalledWith('Automatic Next unavailable - use Next to retry');
  });

  it('Stop/manual Next blocks the current pair until a different pair is observed', async () => {
    const test = create(); test.prototype.update(test.settings); await vi.advanceTimersByTimeAsync(250);
    test.prototype.stopCurrent(); await vi.advanceTimersByTimeAsync(2000); expect(test.deps.next).not.toHaveBeenCalled();
    test.data({ state: 'connected', token: 2, code: 1 }); await vi.advanceTimersByTimeAsync(1000);
    expect(test.deps.next).toHaveBeenCalledTimes(1);
  });

  it('manual cancellation before the first snapshot suppresses that media session conservatively', async () => {
    const test = create(); let resolve!: (data: PrototypeSnapshot) => void;
    test.deps.read.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    test.prototype.update(test.settings); test.prototype.stopCurrent();
    resolve({ state: 'connected', token: 1, code: 1 }); await vi.advanceTimersByTimeAsync(2000);
    expect(test.deps.next).not.toHaveBeenCalled();
    test.session({ id: 2, fingerprint: 'next', video: document.createElement('video') });
    test.data({ state: 'connected', token: 2, code: 1 }); await vi.advanceTimersByTimeAsync(1000);
    expect(test.deps.next).toHaveBeenCalledTimes(1);
  });

  it('reports storage failures without repeatedly incrementing a counter', async () => {
    const test = create(); test.data({ state: 'connected', token: 1, code: 2 }); test.deps.recordGirl.mockRejectedValueOnce(new Error());
    test.prototype.update(test.settings); await vi.advanceTimersByTimeAsync(2000);
    expect(test.deps.recordGirl).toHaveBeenCalledTimes(1); expect(test.deps.onGirl).not.toHaveBeenCalled();
    expect(test.deps.onMessage).toHaveBeenLastCalledWith('Could not save prototype counter');
  });
});
