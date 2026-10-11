import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionAssistant } from '../modules/ometv/assistant';
import type { RuntimeStatus } from '../modules/types';
import type { PartnerSession } from '../modules/ometv/session';

function setup(enabled = true) {
  let status: RuntimeStatus | undefined;
  const deps = { clickNext: vi.fn(() => true), recordSession: vi.fn(async () => {}), recordSkip: vi.fn(async () => {}),
    onStatus: (next: RuntimeStatus) => { status = next; }, onConnection: vi.fn() };
  const assistant = new SessionAssistant(enabled, deps);
  const session = (id: number): PartnerSession => ({ id, video: document.createElement('video'), fingerprint: String(id) });
  return { assistant, deps, session, get status() { return status; } };
}

describe('manual session assistant', () => {
  afterEach(() => vi.useRealTimers());

  it('counts each connection once across updates and pause/resume', () => {
    const test = setup();
    test.assistant.setSession(test.session(1));
    test.assistant.setSession(test.session(1));
    test.assistant.setEnabled(false);
    test.assistant.setEnabled(true);
    expect(test.deps.recordSession).toHaveBeenCalledTimes(1);
    test.assistant.setSession(test.session(2));
    expect(test.deps.recordSession).toHaveBeenCalledTimes(2);
    expect(test.status).toMatchObject({ state: 'connected', canSkip: true });
    test.assistant.destroy();
  });

  it('counts a HUD skip only after a transition and ignores repeated clicks', () => {
    const test = setup();
    test.assistant.setSession(test.session(1));
    test.assistant.next(); test.assistant.next();
    expect(test.deps.clickNext).toHaveBeenCalledTimes(1);
    expect(test.deps.recordSkip).not.toHaveBeenCalled();
    expect(test.status?.state).toBe('skip_pending');
    test.assistant.setSession(null);
    test.assistant.setSession(null);
    expect(test.deps.recordSkip).toHaveBeenCalledTimes(1);
    expect(test.status).toMatchObject({ state: 'waiting', canSkip: false });
    test.assistant.destroy();
  });

  it('counts native Next intent on direct replacement, but not an unsolicited disconnect', () => {
    const test = setup();
    test.assistant.setSession(test.session(1));
    test.assistant.observeNext();
    test.assistant.setSession(test.session(2));
    expect(test.deps.clickNext).not.toHaveBeenCalled();
    expect(test.deps.recordSkip).toHaveBeenCalledTimes(1);
    test.assistant.setSession(null);
    expect(test.deps.recordSkip).toHaveBeenCalledTimes(1);
    test.assistant.destroy();
  });

  it('does not count failed or unavailable Next requests and allows retry', () => {
    vi.useFakeTimers();
    const test = setup();
    test.assistant.setSession(test.session(1));
    test.deps.clickNext.mockReturnValueOnce(false);
    test.assistant.next();
    expect(test.status?.message).toBe('Next control unavailable');
    test.assistant.next();
    vi.advanceTimersByTime(3000);
    expect(test.status?.state).toBe('error');
    expect(test.status?.canSkip).toBe(true);
    test.assistant.setSession(null);
    expect(test.deps.recordSkip).not.toHaveBeenCalled();
    test.assistant.destroy();
  });

  it('cancels intent on Stop, pause, and teardown', () => {
    for (const cancel of ['stop', 'pause', 'destroy']) {
      const test = setup();
      test.assistant.setSession(test.session(1));
      test.assistant.observeNext();
      if (cancel === 'stop') test.assistant.stop();
      if (cancel === 'pause') test.assistant.setEnabled(false);
      if (cancel === 'destroy') test.assistant.destroy();
      test.assistant.setSession(null);
      expect(test.deps.recordSkip).not.toHaveBeenCalled();
      test.assistant.destroy();
    }
  });

  it('counts an existing connection when tracking resumes, without counting paused connections', () => {
    const test = setup(false);
    test.assistant.setSession(test.session(1));
    test.assistant.setSession(test.session(2));
    test.assistant.next();
    expect(test.deps.recordSession).not.toHaveBeenCalled();
    expect(test.deps.clickNext).not.toHaveBeenCalled();
    test.assistant.setEnabled(true);
    expect(test.deps.recordSession).toHaveBeenCalledTimes(1);
    test.assistant.destroy();
  });

  it('reports persistence errors rather than claiming counters were saved', async () => {
    const test = setup();
    test.deps.recordSession.mockRejectedValueOnce(new Error('storage failure'));
    test.assistant.setSession(test.session(1));
    await Promise.resolve();
    expect(test.status?.message).toContain('Could not save counters');
    test.assistant.destroy();
  });
});
