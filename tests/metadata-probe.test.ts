import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findPartnerStore, PartnerMetadataProbe } from '../modules/ometv/metadata-probe';
import type { DiagnosticReport } from '../modules/ometv/diagnostic-report';

function fixture() {
  let state: object = { ownGender: { gender: { slug: 'female' } }, rouletteState: { state: '0', interlocutor: null } };
  const listeners = new Set<() => void>();
  const store = { getState: vi.fn(() => state), subscribe: vi.fn((listener: () => void) => {
    listeners.add(listener); return () => listeners.delete(listener);
  }) };
  const app = document.createElement('div'); app.id = 'app'; document.body.append(app);
  Object.defineProperty(app, '__reactContainer$fixture', { value: { stateNode: { current: { child: { memoizedProps: { store } } } } } });
  return { app, store, listeners, set(partner: object | null, stage = '2') {
    state = { ownGender: { gender: { slug: 'female' } }, rouletteState: { state: stage, interlocutor: partner } };
    listeners.forEach(listener => listener());
  } };
}

describe('read-only partner state probe', () => {
  const probes: PartnerMetadataProbe[] = [];
  beforeEach(() => { vi.useFakeTimers(); document.body.replaceChildren(); });
  afterEach(() => { probes.forEach(probe => probe.destroy()); probes.length = 0; vi.useRealTimers(); });
  const create = () => {
    const reports: DiagnosticReport[] = [];
    const probe = new PartnerMetadataProbe(document, report => reports.push(report));
    probes.push(probe);
    return { probe, reports, latest: () => reports.at(-1)! };
  };

  it('aggregates exact root numeric codes without assigning gender or retaining a timeline', () => {
    const page = fixture(); const { probe, latest } = create(); probe.start();
    const partner = { Gender: 1 };
    page.set(partner); page.set(partner, '3');
    page.set({ Gender: 2 }); page.set({ Gender: '2', DialogData: '{"Gender":2}' }); page.set({});
    expect(latest()).toMatchObject({ checked: 4, withCandidate: 3,
      rootCodeTotals: { code1: 1, code2: 1, otherOrMissing: 2 } });
    probe.stop(); probe.start();
    expect(latest()).toMatchObject({ checked: 1, rootCodeTotals: { code1: 0, code2: 0, otherOrMissing: 1 } });
  });

  it('is dormant until started, excludes own gender and counts an interlocutor only once', () => {
    const page = fixture(); const { probe, latest } = create();
    expect(page.store.getState).not.toHaveBeenCalled();
    expect(findPartnerStore(document)).toBe(page.store);
    probe.start();
    expect(latest()).toMatchObject({ state: 'watching', checked: 0, withCandidate: 0 });
    const partner = { UserId: 'secret', Gender: 1 };
    page.set(partner); page.set(partner, '3'); vi.advanceTimersByTime(1500);
    expect(latest()).toMatchObject({ state: 'watching', checked: 1, withCandidate: 1 });
    expect(latest().fields).toEqual([{ path: 'interlocutor.Gender', format: 'number', value: 1 }]);
    page.set(null, '1'); page.set({ Country: 'secret-country' });
    expect(latest()).toMatchObject({ checked: 2, withCandidate: 1 });
    expect(JSON.stringify(latest())).not.toContain('secret');
  });

  it('reports missing fields only after an actual partner sample', () => {
    const page = fixture(); const { probe, latest } = create(); probe.start();
    page.set({ Gender: 'female' }, '0');
    expect(latest().checked).toBe(0);
    page.set({ UserId: 'secret' }, '3');
    expect(latest()).toMatchObject({ checked: 1, withCandidate: 0, fields: [] });
  });

  it('attaches to a late or replaced React store and releases old subscriptions', () => {
    const { probe, latest } = create(); probe.start(); vi.advanceTimersByTime(2000);
    const first = fixture(); vi.advanceTimersByTime(500);
    expect(latest().state).toBe('watching'); expect(first.listeners.size).toBe(1);
    first.app.remove(); const second = fixture(); vi.advanceTimersByTime(500);
    expect(first.listeners.size).toBe(0); expect(second.listeners.size).toBe(1);
    second.set({ DialogData: '{"gender":"female"}' });
    expect(latest().fields[0]?.path).toBe('DialogData.gender');
  });

  it('reports unavailable rather than absence if the site state cannot be read', () => {
    const { probe, latest } = create(); probe.start(); vi.advanceTimersByTime(10000);
    expect(latest()).toMatchObject({ state: 'unavailable', issue: 'store_unavailable', checked: 0 });
    const page = fixture(); vi.advanceTimersByTime(1000); expect(page.store.subscribe).not.toHaveBeenCalled();
  });

  it('fails closed on a throwing store without exposing its error', () => {
    const page = fixture(); page.store.getState.mockImplementation(() => { throw new Error('secret'); });
    const { probe, latest } = create(); probe.start();
    expect(latest().state).toBe('unavailable'); expect(JSON.stringify(latest())).not.toContain('secret');
  });

  it('stops after 20 samples, a user stop, or five minutes and restarts fresh', () => {
    const page = fixture(); const { probe, latest } = create(); probe.start();
    for (let i = 0; i < 21; i++) page.set({ Gender: 'female' });
    expect(latest()).toMatchObject({ state: 'complete', checked: 20 }); expect(page.listeners.size).toBe(0);
    page.set(null, '1'); probe.start(); page.set({}); probe.stop(); page.set({ Gender: 'male' });
    expect(latest()).toMatchObject({ state: 'complete', checked: 1, withCandidate: 0 });
    page.set(null, '1'); probe.start(); vi.advanceTimersByTime(300000);
    expect(latest()).toMatchObject({ state: 'idle', checked: 0 }); expect(page.listeners.size).toBe(0);
  });

  it('bounds root traversal even when fibers contain cycles', () => {
    const app = document.createElement('div'); app.id = 'app'; document.body.append(app);
    const cycle: { child?: unknown } = {}; cycle.child = cycle;
    Object.defineProperty(app, '__reactContainer$fixture', { value: cycle });
    expect(findPartnerStore(document)).toBeNull();
  });
});
