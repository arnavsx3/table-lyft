import { browser } from 'wxt/browser';
import { getSettings, saveSettings, getStats, recordSession, recordManualSkip, toggleEnabled, onSettingsChanged, onStatsChanged } from '@/modules/storage';
import { OmeSkipper, findNextButton } from '@/modules/ometv/skipper';
import { WingmanInPageHud } from '@/modules/ometv/hud';
import { PartnerSessionTracker } from '@/modules/ometv/session';
import { SessionAssistant } from '@/modules/ometv/assistant';
import { PartnerDiagnosticClient } from '@/modules/ometv/diagnostic-client';
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
    let diagnostic = idleDiagnostic();
    const hud = new WingmanInPageHud();
    const renderStatus = () => {
      status = { ...baseStatus, diagnostic };
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
      recordSession, recordSkip: recordManualSkip,
      onConnection: () => { if (settings.soundAlertOnMatch) void audio.playMatchSound(); },
      onStatus: setStatus,
    });
    const tracker = new PartnerSessionTracker(session => assistant.setSession(session));
    const retry = () => { tracker.check(); assistant.retry(); };
    const manualNext = () => { tracker.check(); assistant.next(); };
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
        tracker.check(); assistant.observeNext();
      }
    }, { capture: true });
    ctx.addEventListener(document, 'click', event => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const next = findNextButton();
      if (next?.contains(event.target)) { tracker.check(); assistant.observeNext(); }
      if (event.target.closest(STOP_SELECTORS.join(','))) assistant.stop();
    }, { capture: true });

    ctx.onInvalidated(() => {
      diagnostics.destroy(); assistant.destroy(); tracker.destroy(); audio.destroy(); hud.destroy();
      unwatchSettings(); unwatchStats(); browser.runtime.onMessage.removeListener(listener);
    });
    tracker.start();
    assistant.retry();
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
    } catch { if (!disposed) reportError('Could not refresh saved settings and counters'); }
  },
});
