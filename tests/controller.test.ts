import { describe, expect, it, vi } from 'vitest';
import { WingmanController } from '../modules/ometv/controller';
import { DEFAULT_SETTINGS } from '../modules/preferences';
import type { PartnerDetectedEvent, RuntimeStatus, WingmanSettings } from '../modules/types';
import type { PartnerSession } from '../modules/ometv/session';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function setup(settings: WingmanSettings = DEFAULT_SETTINGS) {
  let current = 1;
  let onPartner: (event: PartnerDetectedEvent) => void = () => {};
  let status: RuntimeStatus | undefined;
  const vision = { load: vi.fn(async () => {}), stop: vi.fn(), destroy: vi.fn(),
    start: vi.fn((_session, _settings, _valid, callback) => { onPartner = callback; }) };
  const skipper = { skipPartner: vi.fn(async () => true), cancel: vi.fn(), destroy: vi.fn(), playMatchSound: vi.fn(async () => {}) };
  const recordSkip = vi.fn(async () => {});
  const recordMatch = vi.fn(async () => {});
  const controller = new WingmanController(settings, { vision, skipper, isCurrent: id => current === id,
    recordSkip, recordMatch, onStatus: next => { status = next; } });
  const session = (id: number): PartnerSession => ({ id, video: document.createElement('video'), fingerprint: String(id) });
  return { controller, vision, skipper, recordSkip, recordMatch, session,
    emit: (gender: PartnerDetectedEvent['gender'], sessionId = current) => onPartner({ sessionId, gender }),
    change: (id: number) => { current = id; controller.setSession(session(id)); },
    get status() { return status; } };
}

describe('connection controller', () => {
  it('records a preferred match once, including after pause and resume', async () => {
    const test = setup();
    test.change(1);
    await flush();
    test.emit('female'); test.emit('female');
    await flush();
    test.controller.updateSettings({ ...DEFAULT_SETTINGS, enabled: false });
    test.controller.updateSettings(DEFAULT_SETTINGS);
    await flush();
    test.emit('female');
    await flush();
    expect(test.recordMatch).toHaveBeenCalledTimes(1);
    expect(test.skipper.playMatchSound).toHaveBeenCalledTimes(1);
    expect(test.skipper.skipPartner).not.toHaveBeenCalled();
  });

  it('implements the men preference and does not count an uncertain result as male', async () => {
    const test = setup({ ...DEFAULT_SETTINGS, targetGender: 'boys_only' });
    test.change(1); await flush(); test.emit('female'); await flush();
    expect(test.recordSkip).toHaveBeenCalledWith('female');
    test.change(2); await flush(); test.emit('unknown'); await flush();
    expect(test.status?.state).toBe('uncertain');
    expect(test.recordSkip).toHaveBeenCalledTimes(1);
    expect(test.recordMatch).not.toHaveBeenCalled();
  });

  it('rejects a late prediction from a previous partner', async () => {
    const test = setup();
    test.change(1); await flush();
    const oldCallback = test.vision.start.mock.calls[0][3];
    test.change(2); await flush();
    oldCallback({ sessionId: 1, gender: 'male' });
    test.emit('female'); await flush();
    expect(test.skipper.skipPartner).not.toHaveBeenCalled();
    expect(test.recordMatch).toHaveBeenCalledTimes(1);
  });

  it('cancels pending work when paused, switched to all, or manually skipped', async () => {
    const test = setup();
    test.change(1); await flush();
    const stale = test.vision.start.mock.calls[0][3];
    test.controller.updateSettings({ ...DEFAULT_SETTINGS, enabled: false });
    stale({ sessionId: 1, gender: 'male' }); await flush();
    expect(test.status?.state).toBe('paused');
    expect(test.skipper.skipPartner).not.toHaveBeenCalled();
    test.controller.updateSettings({ ...DEFAULT_SETTINGS, targetGender: 'all' });
    await flush();
    expect(test.status?.state).toBe('paused');
    test.controller.updateSettings(DEFAULT_SETTINGS); await flush();
    const manualStale = test.vision.start.mock.calls.at(-1)![3];
    test.controller.handleManualAction();
    manualStale({ sessionId: 1, gender: 'male' }); await flush();
    expect(test.skipper.skipPartner).not.toHaveBeenCalled();
    expect(test.skipper.cancel).toHaveBeenCalled();
  });

  it('reports model errors and retries without pretending to be ready', async () => {
    const test = setup();
    test.vision.load.mockRejectedValueOnce(new Error('missing models'));
    test.change(1); await flush();
    expect(test.status?.state).toBe('model_error');
    expect(test.vision.start).not.toHaveBeenCalled();
    test.controller.retry(); await flush();
    expect(test.status?.state).toBe('analyzing');
  });

  it('does not count a failed click and permits explicit retry', async () => {
    const test = setup();
    test.skipper.skipPartner.mockResolvedValueOnce(false);
    test.change(1); await flush(); test.emit('male'); await flush();
    expect(test.status?.state).toBe('skip_unavailable');
    expect(test.recordSkip).not.toHaveBeenCalled();
    test.controller.retry(); await flush(); test.emit('male'); await flush();
    expect(test.recordSkip).toHaveBeenCalledTimes(1);
  });

  it('counts a successful click even if the connection changes synchronously', async () => {
    const test = setup();
    test.skipper.skipPartner.mockImplementationOnce(async () => { test.change(2); return true; });
    test.change(1); await flush(); test.emit('male'); await flush();
    expect(test.recordSkip).toHaveBeenCalledTimes(1);
    expect(test.status?.state).toBe('analyzing');
  });

  it('ignores a model load that finishes after teardown', async () => {
    const test = setup();
    let resolve!: () => void;
    test.vision.load.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    test.change(1); test.controller.destroy(); resolve(); await flush();
    expect(test.vision.start).not.toHaveBeenCalled();
    expect(test.skipper.destroy).toHaveBeenCalled();
  });
});
