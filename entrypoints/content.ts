import { browser } from 'wxt/browser';
import { getSettings, saveSettings, getStats, recordSession, recordManualSkip, recordPrototypeGirl, recordPrototypeSkip, toggleEnabled, onSettingsChanged, onStatsChanged } from '@/modules/storage';
import { OmeSkipper, findNextButton } from '@/modules/ometv/skipper';
import { WingmanInPageHud } from '@/modules/ometv/hud';
import { PartnerSessionTracker } from '@/modules/ometv/session';
import { SessionAssistant } from '@/modules/ometv/assistant';
import { PartnerDiagnosticClient } from '@/modules/ometv/diagnostic-client';
import { PrototypeClient } from '@/modules/ometv/prototype-client';
import { MetadataPrototype } from '@/modules/ometv/prototype';
import { downloadDiagnostic, idleDiagnostic } from '@/modules/ometv/diagnostic-report';
import { SITE_MATCHES, STOP_SELECTORS } from '@/modules/ometv/constants';
import type { RuntimeStatus } from '@/modules/types';

export default defineContentScript({
  matches: SITE_MATCHES,
  runAt: 'document_idle',
  async main(ctx) {
    let disposed = false;
    ctx.onInvalidated(() => { disposed = true; });
    let [settings, stats] = await Promise.all([getSettings(), getStats()]);
    if (disposed) return;
    let settingsRevision = 0;
    let statsRevision = 0;
    let status: RuntimeStatus = { state: 'waiting', message: 'Waiting for next connection', canSkip: false };
    let baseStatus = status;
    let prototypeMessage: string | undefined;
    let diagnostic = idleDiagnostic();
    const hud = new WingmanInPageHud();
    const renderStatus = () => {
      status = { ...baseStatus, diagnostic,
        message: baseStatus.state === 'connected' && prototypeMessage ? prototypeMessage : baseStatus.message };
      hud.setStatus(status);
    };
    const setStatus = (next: RuntimeStatus) => { baseStatus = next; renderStatus(); };
    const diagnostics = new PartnerDiagnosticClient(next => { diagnostic = next; renderStatus(); });
    const reportError = (message: string) => setStatus({ ...status, state: 'error', message });
    const audio = new OmeSkipper();
    const assistant = new SessionAssistant(settings.enabled, {
      clickNext: () => {
        const button = findNextButton();
        if (!button) return false;
        button.click();
        return true;
      },
      recordSession, recordSkip: recordManualSkip, recordAutoSkip: recordPrototypeSkip,
      onConnection: () => { if (settings.soundAlertOnMatch && !settings.experimentalAutoSkip) void audio.playMatchSound(); },
      onStatus: setStatus,
    });
    const tracker = new PartnerSessionTracker(session => assistant.setSession(session));
    const prototypeClient = new PrototypeClient();
    const prototype = new MetadataPrototype(settings, {
      read: fingerprint => prototypeClient.read(fingerprint), cancelRead: () => prototypeClient.cancel(),
      current: () => tracker.current, isCurrent: id => tracker.isCurrent(id),
      canSkip: () => !!baseStatus.canSkip,
      next: () => { tracker.check(); return assistant.next(true); },
      confirmTransition: () => assistant.confirmAutomaticTransition(),
      recordGirl: recordPrototypeGirl,
      onGirl: () => { if (settings.soundAlertOnMatch) void audio.playMatchSound(); },
      onMessage: message => { if (prototypeMessage !== message) { prototypeMessage = message; renderStatus(); } },
    });
    const retry = () => { tracker.check(); assistant.retry(); };
    const manualNext = () => { prototype.stopCurrent(); tracker.check(); assistant.next(); };
    const toggle = () => { void toggleEnabled().catch(() => reportError('Could not save settings')); };
    hud.init(toggle, manualNext, retry, () => {
      void saveSettings({ showInPageHud: false }).catch(() => reportError('Could not save settings'));
    }, () => diagnostics.start(), () => diagnostics.stop(), () => downloadDiagnostic(diagnostic, browser.runtime.getManifest().version));
    hud.update(settings, stats);
    const unwatchSettings = onSettingsChanged(next => {
      settingsRevision++;
      settings = next;
      hud.update(settings, stats);
      assistant.setEnabled(settings.enabled);
      if (!settings.experimentalAutoSkip) assistant.cancelAutomatic();
      prototype.update(settings);
    });
    const unwatchStats = onStatsChanged(next => { statsRevision++; stats = next; hud.update(settings, stats); });
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message, sender, respond) => {
      if (sender.id !== browser.runtime.id) return;
      if (message?.type === 'WINGMAN_STATUS') respond(status);
      if (message?.type === 'WINGMAN_RETRY') { retry(); respond({ ok: true }); }
      if (message?.type === 'WINGMAN_NEXT') { manualNext(); respond({ ok: true }); }
      if (message?.type === 'WINGMAN_DIAGNOSTIC_START') { diagnostics.start(); respond({ ok: true }); }
      if (message?.type === 'WINGMAN_DIAGNOSTIC_STOP') { diagnostics.stop(); respond({ ok: true }); }
    };
    browser.runtime.onMessage.addListener(listener);
    ctx.addEventListener(window, 'keydown', event => {
      const target = event.target;
      const editing = target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
      if (editing || event.repeat) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyW') {
        event.preventDefault();
        toggle();
      } else if (event.isTrusted && event.key === 'ArrowRight' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && findNextButton()) {
        prototype.stopCurrent(); tracker.check(); assistant.observeNext();
      }
    }, { capture: true });
    ctx.addEventListener(document, 'click', event => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const next = findNextButton();
      if (next?.contains(event.target)) { prototype.stopCurrent(); tracker.check(); assistant.observeNext(); }
      if (event.target.closest(STOP_SELECTORS.join(','))) { prototype.stopCurrent(); assistant.stop(); }
    }, { capture: true });

    ctx.onInvalidated(() => {
      prototype.destroy(); prototypeClient.destroy(); diagnostics.destroy(); assistant.destroy(); tracker.destroy(); audio.destroy(); hud.destroy();
      unwatchSettings(); unwatchStats(); browser.runtime.onMessage.removeListener(listener);
    });
    tracker.start();
    assistant.retry();
    prototype.update(settings);
    // Reconcile the initial subscription gap without overwriting newer storage events.
    const settingsAtRead = settingsRevision;
    const statsAtRead = statsRevision;
    try {
      const [latestSettings, latestStats] = await Promise.all([getSettings(), getStats()]);
      if (disposed) return;
      if (settingsRevision === settingsAtRead) settings = latestSettings;
      if (statsRevision === statsAtRead) stats = latestStats;
      hud.update(settings, stats);
      assistant.setEnabled(settings.enabled);
      if (!settings.experimentalAutoSkip) assistant.cancelAutomatic();
      prototype.update(settings);
    } catch { if (!disposed) reportError('Could not refresh saved settings and counters'); }
  },
});
