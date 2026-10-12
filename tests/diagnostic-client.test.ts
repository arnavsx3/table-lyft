import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { PartnerDiagnosticClient } from '../modules/ometv/diagnostic-client';
import { DIAGNOSTIC_CHANNEL, idleDiagnostic, type DiagnosticReport } from '../modules/ometv/diagnostic-report';

describe('diagnostic page-world boundary', () => {
  let client: PartnerDiagnosticClient;
  let publish: Mock<(report: DiagnosticReport) => void>;
  let post: MockInstance<typeof window.postMessage>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('location', { hostname: 'ome.tv', origin: 'https://ome.tv' });
    publish = vi.fn(); post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    client = new PartnerDiagnosticClient(publish);
  });
  afterEach(() => { client.destroy(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const reply = (patch: object = {}, origin = 'https://ome.tv', source: MessageEventSource | null = window) => {
    const start = post.mock.calls.findLast(call => call[0].type === 'START')![0];
    window.dispatchEvent(new MessageEvent('message', { origin, source, data: {
      channel: DIAGNOSTIC_CHANNEL, type: 'REPORT', requestId: start.requestId,
      report: { ...idleDiagnostic(), state: 'watching' }, ...patch,
    } }));
  };

  it('accepts only valid, same-window, same-origin, current-request responses', () => {
    client.start(); const count = publish.mock.calls.length;
    reply({}, 'https://evil.example'); reply({}, 'https://ome.tv', null); reply({ requestId: 'old' });
    reply({ report: { ...idleDiagnostic(), checked: 100 } });
    expect(publish).toHaveBeenCalledTimes(count);
    reply({ report: { ...idleDiagnostic(), state: 'watching', raw: 'secret' } });
    expect(publish.mock.calls.at(-1)![0]).toEqual({ ...idleDiagnostic(), state: 'watching' });
    vi.advanceTimersByTime(3000); expect(publish.mock.calls.at(-1)![0].state).toBe('watching');
  });

  it('distinguishes an absent bridge, drops stale responses, and clears pending timeouts on stop', () => {
    client.start(); vi.advanceTimersByTime(2500);
    expect(publish.mock.calls.at(-1)![0]).toMatchObject({ state: 'unavailable', issue: 'bridge_unavailable' });
    reply(); expect(publish.mock.calls.at(-1)![0].state).toBe('unavailable');
    client.start(); client.stop(); vi.advanceTimersByTime(3000); reply();
    expect(publish.mock.calls.at(-1)![0].state).toBe('idle');
  });

  it('does not inspect MiniChat or unrelated domains', () => {
    vi.stubGlobal('location', { hostname: 'minichat.com', origin: 'https://minichat.com' });
    client.start(); expect(post).not.toHaveBeenCalled();
    expect(publish.mock.calls.at(-1)![0]).toMatchObject({ issue: 'unsupported_site' });
  });
});
