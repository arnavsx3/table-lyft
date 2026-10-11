export default defineContentScript({
  matches: [
    '*://*.ome.tv/*',
    '*://ome.tv/*',
    '*://*.minichat.com/*',
    '*://minichat.com/*'
  ],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    console.log('[Wingman] Injected main-world interceptor active.');

    const OriginalWebSocket = window.WebSocket;
    const OriginalPeerConnection = window.RTCPeerConnection;
    const OriginalFetch = window.fetch;

    function processIncoming(data: any, channel = 'WS') {
      if (!data) return;

      if (data instanceof Blob) {
        data.text().then((text) => inspectMessage(text, channel)).catch(() => {});
        return;
      }
      if (data instanceof ArrayBuffer) {
        try {
          const text = new TextDecoder().decode(data);
          inspectMessage(text, channel);
        } catch {}
        return;
      }
      if (typeof data === 'string') {
        inspectMessage(data, channel);
      }
    }

    function inspectMessage(data: string, channel: string) {
      // Log for diagnosis
      console.log(`[Wingman ${channel} Frame]:`, data.length > 250 ? data.slice(0, 250) + '...' : data);

      try {
        const parsed = JSON.parse(data);
        parsePayload(parsed);
      } catch {
        // Regex extraction for non-JSON or packed formats
        const match = data.match(/"gender"\s*:\s*"?([a-zA-Z0-9_-]+)"?/i) ||
                      data.match(/"g"\s*:\s*"?([a-zA-Z0-9_-]+)"?/i) ||
                      data.match(/"sex"\s*:\s*"?([a-zA-Z0-9_-]+)"?/i);
        if (match) {
          notifyWingman(normalizeGender(match[1]), undefined, data);
        }
      }
    }

    function parsePayload(payload: any) {
      if (!payload || typeof payload !== 'object') return;

      // Extract gender from various schemas
      const genderRaw = payload.gender ??
                        payload.g ??
                        payload.sex ??
                        payload.user?.gender ??
                        payload.partner?.gender ??
                        payload.client?.gender ??
                        payload.stranger?.gender ??
                        payload.peer?.gender ??
                        payload.data?.gender;

      const country = payload.country ??
                      payload.c ??
                      payload.user?.country ??
                      payload.partner?.country ??
                      payload.client?.country;

      if (genderRaw !== undefined) {
        const normalized = normalizeGender(genderRaw);
        console.log(`[Wingman] Extracted gender: "${genderRaw}" -> ${normalized}`);
        notifyWingman(normalized, country, payload);
      }
    }

    function normalizeGender(val: any): 'male' | 'female' | 'unknown' {
      if (typeof val === 'number') {
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

    // 1. Hook WebSocket
    // @ts-ignore
    window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
      console.log('[Wingman WS] Connection initiated to:', String(url));
      const ws = new OriginalWebSocket(url, protocols);

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          processIncoming(event.data, 'WS');
        } catch (err) {
          console.error('[Wingman] Error inspecting WS frame:', err);
        }
      });

      const origSend = ws.send;
      ws.send = function (data: any) {
        if (typeof data === 'string' && (data.includes('gender') || data.includes('ready') || data.includes('next'))) {
          console.log('[Wingman WS -> Server]:', data.slice(0, 200));
        }
        return origSend.apply(this, arguments as any);
      };

      return ws;
    };

    window.WebSocket.prototype = OriginalWebSocket.prototype;
    // @ts-ignore
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    // @ts-ignore
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    // @ts-ignore
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    // @ts-ignore
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

    // 2. Hook WebRTC PeerConnection & DataChannels
    if (OriginalPeerConnection) {
      // @ts-ignore
      window.RTCPeerConnection = function (...args: any[]) {
        console.log('[Wingman WebRTC] PeerConnection created');
        const pc = new OriginalPeerConnection(...args);

        pc.addEventListener('datachannel', (event: RTCDataChannelEvent) => {
          console.log('[Wingman WebRTC] DataChannel open:', event.channel.label);
          event.channel.addEventListener('message', (msgEvt) => {
            processIncoming(msgEvt.data, 'RTC');
          });
        });

        return pc;
      };
      window.RTCPeerConnection.prototype = OriginalPeerConnection.prototype;
    }

    // 3. Hook fetch for matchmaking endpoints
    window.fetch = async function (...args: any[]) {
      const url = String(args[0] || '');
      const response = await OriginalFetch.apply(this, args as any);

      if (url.includes('match') || url.includes('partner') || url.includes('user') || url.includes('client')) {
        try {
          const clone = response.clone();
          clone.json().then((json) => parsePayload(json)).catch(() => {});
        } catch {}
      }

      return response;
    };
  }
});
