import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrototypePartnerReader, sanitizePrototype } from '../modules/ometv/prototype-data';
import { remoteVideoSnapshot } from '../modules/ometv/session';

vi.mock('../modules/ometv/session', () => ({ remoteVideoSnapshot: vi.fn() }));

function fixture() {
  let roulette: object = { state: '0', interlocutor: null };
  const store = { getState: () => ({ ownGender: { gender: { value: 2 } }, rouletteState: roulette }), subscribe: () => () => {} };
  const app = document.createElement('div'); app.id = 'app'; document.body.append(app);
  Object.defineProperty(app, '__reactContainer$fixture', { value: { memoizedProps: { store } } });
  return { set(partner: object | null, state = '3') { roulette = { state, interlocutor: partner }; } };
}

describe('experimental current-partner snapshot', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.mocked(remoteVideoSnapshot).mockReturnValue({ video: document.createElement('video'), fingerprint: 'stream' });
  });

  it('requires an established connection, matching media and a pair binding', () => {
    const page = fixture(); const reader = new PrototypePartnerReader(document);
    expect(reader.read('stream').state).toBe('waiting');
    page.set({ Gender: 1 }); expect(reader.read('stream').state).toBe('waiting');
    page.set({ Gender: 1, PairId: 'private-pair' }, '2'); expect(reader.read('stream').state).toBe('waiting');
    page.set({ Gender: 1, PairId: 'private-pair' });
    expect(reader.read('wrong').state).toBe('waiting');
    const result = reader.read('stream');
    expect(result).toEqual({ state: 'connected', token: 1, code: 1 });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(reader.read('stream')).toEqual(result);
    page.set({ Gender: 2, PairId: 'next-pair' }); expect(reader.read('stream').token).toBe(2);
  });

  it.each([undefined, null, '2', 'female', true, 0, 3, {}, NaN])('never coerces or guesses code %s', value => {
    const page = fixture(); const reader = new PrototypePartnerReader(document);
    page.set({ PairId: 1, Gender: value, DialogData: '{"Gender":2}', gender: 2 });
    expect(reader.read('stream')).toMatchObject({ state: 'connected', code: null });
  });

  it('does not invoke gender getters or read own gender', () => {
    const page = fixture(); const reader = new PrototypePartnerReader(document); const getter = vi.fn(() => 2);
    const partner = { PairId: 1 }; Object.defineProperty(partner, 'Gender', { get: getter });
    page.set(partner); expect(reader.read('stream').code).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });

  it('rejects a replacement stream until the page establishes a new pair', () => {
    const page = fixture(); const reader = new PrototypePartnerReader(document);
    page.set({ PairId: 1, Gender: 1 }); expect(reader.read('stream').state).toBe('connected');
    vi.mocked(remoteVideoSnapshot).mockReturnValue({ video: document.createElement('video'), fingerprint: 'new-stream' });
    expect(reader.read('new-stream').state).toBe('waiting');
    page.set({ PairId: 2, Gender: 2 }); expect(reader.read('new-stream')).toMatchObject({ state: 'connected', code: 2, token: 2 });
  });

  it('returns unavailable for missing stores and drops unknown message properties', () => {
    const reader = new PrototypePartnerReader(document); expect(reader.read('stream').state).toBe('unavailable');
    expect(sanitizePrototype({ state: 'connected', token: 1, code: 2, UserId: 'private' })).toEqual({ state: 'connected', token: 1, code: 2 });
    for (const value of [null, {}, { state: 'connected', token: 0, code: 2 }, { state: 'connected', token: 1, code: '2' },
      { state: 'waiting', token: 1, code: 1 }, { state: 'connected', token: -1, code: 2 }]) expect(sanitizePrototype(value)).toBeNull();
  });
});
