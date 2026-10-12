import { DIAGNOSTIC_CHANNEL, idleDiagnostic, sanitizeDiagnostic, type DiagnosticReport } from './diagnostic-report';

export class PartnerDiagnosticClient {
  private report = idleDiagnostic();
  private requestId = '';
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private listener = (event: MessageEvent) => {
    if (!this.active || event.source !== window || event.origin !== location.origin || event.data?.channel !== DIAGNOSTIC_CHANNEL ||
      event.data.type !== 'REPORT' || event.data.requestId !== this.requestId) return;
    const safe = sanitizeDiagnostic(event.data.report);
    if (!safe) return;
    this.clearTimeout();
    this.report = safe;
    if (safe.state !== 'waiting' && safe.state !== 'watching') this.active = false;
    this.publish(safe);
  };

  constructor(private publish: (report: DiagnosticReport) => void) { window.addEventListener('message', this.listener); }

  start() {
    this.stop();
    if (!/(^|\.)ome\.tv$/i.test(location.hostname)) {
      this.report = { ...idleDiagnostic(), state: 'unavailable', issue: 'unsupported_site' };
      this.publish(this.report); return;
    }
    this.active = true;
    this.requestId = crypto.randomUUID();
    this.report = { ...idleDiagnostic(), state: 'waiting' };
    this.publish(this.report);
    this.timeout = setTimeout(() => {
      this.command('STOP'); this.active = false;
      this.report = { ...idleDiagnostic(), state: 'unavailable', issue: 'bridge_unavailable' };
      this.publish(this.report);
    }, 2500);
    this.command('START');
  }

  stop() {
    if (this.active) this.command('STOP');
    this.active = false;
    this.clearTimeout();
    this.report = { ...this.report, state: this.report.checked ? 'complete' : 'idle' };
    this.publish(this.report);
  }

  destroy() { this.stop(); window.removeEventListener('message', this.listener); }

  private command(type: 'START' | 'STOP') {
    window.postMessage({ channel: DIAGNOSTIC_CHANNEL, type, requestId: this.requestId }, location.origin);
  }

  private clearTimeout() { if (this.timeout !== null) clearTimeout(this.timeout); this.timeout = null; }
}
