import { DIAGNOSTIC_CHANNEL } from '@/modules/ometv/diagnostic-report';
import { PartnerMetadataProbe } from '@/modules/ometv/metadata-probe';
import { PROTOTYPE_CHANNEL, PrototypePartnerReader } from '@/modules/ometv/prototype-data';

export default defineContentScript({
  matches: ['*://ome.tv/*', '*://*.ome.tv/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    let requestId = '';
    const reader = new PrototypePartnerReader(document);
    const probe = new PartnerMetadataProbe(document, report => {
      window.postMessage({ channel: DIAGNOSTIC_CHANNEL, type: 'REPORT', requestId, report }, location.origin);
    });
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin) return;
      if (event.data?.channel === PROTOTYPE_CHANNEL) {
        const { type, requestId: id, fingerprint } = event.data;
        if (type === 'READ' && typeof id === 'string' && /^[a-f\d-]{36}$/.test(id) &&
          typeof fingerprint === 'string' && fingerprint.length > 0 && fingerprint.length <= 1024) {
          window.postMessage({ channel: PROTOTYPE_CHANNEL, type: 'SNAPSHOT', requestId: id,
            snapshot: reader.read(fingerprint) }, location.origin);
        }
        return;
      }
      if (event.data?.channel !== DIAGNOSTIC_CHANNEL) return;
      const { type, requestId: id } = event.data;
      if (typeof id !== 'string' || !/^[a-f\d-]{36}$/.test(id)) return;
      if (type === 'START') { requestId = id; probe.start(); }
      if (type === 'STOP' && id === requestId) probe.stop();
    };
    window.addEventListener('message', listener);
    window.addEventListener('pagehide', () => probe.stop());
  },
});
