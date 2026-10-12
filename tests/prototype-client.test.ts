import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrototypeClient } from '../modules/ometv/prototype-client';
import { PROTOTYPE_CHANNEL } from '../modules/ometv/prototype-data';

describe('experimental snapshot request bridge', () => {
  const clients: PrototypeClient[] = [];
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal('location', { hostname: 'ome.tv', origin: 'https://ome.tv' });
    vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  });
  afterEach(() => { clients.forEach(client => client.destroy()); clients.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const create = () => { const client = new PrototypeClient(); clients.push(client); return client; };
  const reply = (id: string, snapshot: unknown, origin = location.origin, source: MessageEventSource | null = window) => {
    window.dispatchEvent(new MessageEvent('message', { origin, source, data: { channel: PROTOTYPE_CHANNEL, type: 'SNAPSHOT', requestId: id, snapshot } }));
  };
  const requestId = () => vi.mocked(window.postMessage).mock.calls.at(-1)![0].requestId as string;

  it('accepts only a current, same-window/origin response and rebuilds its bounded data', async () => {
    const client = create(); const result = client.read('stream'); const id = requestId();
    const data = { state: 'connected', token: 1, code: 2, UserId: 'private' };
    reply('stale', data); reply(id, data, 'https://example.com'); reply(id, data, location.origin, null);
    reply(id, { state: 'connected', token: 1, code: '2' }); reply(id, data);
    await expect(result).resolves.toEqual({ state: 'connected', token: 1, code: 2 });
  });

  it('times out missing or malformed responses without a decision', async () => {
    const client = create(); const result = client.read('stream'); reply(requestId(), {});
    await vi.advanceTimersByTimeAsync(1200); await expect(result).resolves.toBeNull();
  });

  it('cancels old requests on replacement, pause or teardown', async () => {
    const client = create(); const old = client.read('first'); const oldId = requestId();
    const next = client.read('second'); const nextId = requestId(); await expect(old).resolves.toBeNull();
    reply(oldId, { state: 'connected', token: 1, code: 1 }); reply(nextId, { state: 'connected', token: 2, code: null });
    await expect(next).resolves.toEqual({ state: 'connected', token: 2, code: null });
    const cancelled = client.read('third'); client.destroy(); await expect(cancelled).resolves.toBeNull();
  });
});
