import { WINGMAN_WS_EVENT_NAME } from '@/modules/ometv/constants';

export default defineContentScript({
  matches: ['*://*.ome.tv/*', '*://ome.tv/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    console.log('[Wingman] Injected main-world WebSocket interceptor initialized.');

    const OriginalWebSocket = window.WebSocket;

    // Track active WebSocket connections
    const activeSockets = new Set<WebSocket>();

    function inspectMessage(data: any) {
      if (typeof data !== 'string') return;

      try {
        // Try parsing JSON payload
        const parsed = JSON.parse(data);
        parsePayload(parsed);
      } catch {
        // Some protocols use key:value or delimiter strings
        if (typeof data === 'string' && (data.includes('gender') || data.includes('client') || data.includes('"g"'))) {
          try {
            const match = data.match(/"gender"\s*:\s*"?([a-zA-Z0-9_-]+)"?/i) ||
                          data.match(/"g"\s*:\s*"?([a-zA-Z0-9_-]+)"?/i) ||
                          data.match(/"sex"\s*:\s*"?([a-zA-Z0-9_-]+)"?/i);
            if (match) {
              notifyWingman(normalizeGender(match[1]), undefined, data);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    }

    function parsePayload(payload: any) {
      if (!payload || typeof payload !== 'object') return;

      // Extract gender from object or nested objects
      const genderRaw = payload.gender ||
                        payload.g ||
                        payload.sex ||
                        payload.user?.gender ||
                        payload.partner?.gender ||
                        payload.client?.gender ||
                        payload.stranger?.gender;

      const country = payload.country ||
                      payload.c ||
                      payload.user?.country ||
                      payload.partner?.country ||
                      payload.client?.country;

      if (genderRaw !== undefined) {
        notifyWingman(normalizeGender(genderRaw), country, payload);
      }
    }

    function normalizeGender(val: any): 'male' | 'female' | 'unknown' {
      if (typeof val === 'number') {
        // Frequently 1=male, 2=female or vice versa
        if (val === 1) return 'male';
        if (val === 2) return 'female';
      }
      const str = String(val).toLowerCase().trim();
      if (str === 'm' || str === 'male' || str === 'boy' || str === '1') return 'male';
      if (str === 'f' || str === 'female' || str === 'girl' || str === '2') return 'female';
      return 'unknown';
    }

    function notifyWingman(gender: 'male' | 'female' | 'unknown', country?: string, raw?: any) {
      window.postMessage({
        source: 'WINGMAN_INJECTED',
        type: 'PARTNER_DATA',
        payload: {
          gender,
          country,
          source: 'websocket',
          timestamp: Date.now()
        }
      }, '*');
    }

    // Proxy WebSocket
    // @ts-ignore
    window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
      const ws = new OriginalWebSocket(url, protocols);
      activeSockets.add(ws);

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          inspectMessage(event.data);
        } catch (err) {
          console.error('[Wingman] Error inspecting WS frame:', err);
        }
      });

      ws.addEventListener('close', () => {
        activeSockets.delete(ws);
      });

      return ws;
    };

    // Retain prototype chain & static properties
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    // @ts-ignore
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    // @ts-ignore
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    // @ts-ignore
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    // @ts-ignore
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  }
});
