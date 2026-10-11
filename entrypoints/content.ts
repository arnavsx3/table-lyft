import { browser } from 'wxt/browser';
import { getSettings, getStats, recordSkip, recordMatch, toggleEnabled, onSettingsChanged, onStatsChanged } from '@/modules/storage';
import { OmeSkipper, findNextButton } from '@/modules/ometv/skipper';
import { WingmanInPageHud } from '@/modules/ometv/hud';
import { OmeAiVisionDetector } from '@/modules/ometv/vision';
import { PartnerSessionTracker } from '@/modules/ometv/session';
import { WingmanController } from '@/modules/ometv/controller';
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
    let status: RuntimeStatus = { state: 'waiting', message: 'Waiting for next connection' };
    const hud = new WingmanInPageHud();
    const setStatus = (next: RuntimeStatus) => {
      status = next;
      hud.setStatusText(next.message, ['error', 'model_error', 'skip_unavailable'].includes(next.state) ? '#fb7185' : '#82d6bc');
    };
    const tracker = new PartnerSessionTracker(session => controller.setSession(session));
    const controller = new WingmanController(settings, {
      vision: new OmeAiVisionDetector(), skipper: new OmeSkipper(),
      isCurrent: id => tracker.isCurrent(id), recordSkip, recordMatch, onStatus: setStatus,
    });
    const toggle = () => { void toggleEnabled().catch(() => setStatus({ state: 'error', message: 'Could not save settings' })); };
    hud.init(toggle);
    hud.update(settings, stats);

    const unwatchSettings = onSettingsChanged(next => {
      settings = next;
      hud.update(settings, stats);
      controller.updateSettings(settings);
    });
    const unwatchStats = onStatsChanged(next => { stats = next; hud.update(settings, stats); });
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message, sender, respond) => {
      if (sender.id !== browser.runtime.id) return;
      if (message?.type === 'WINGMAN_STATUS') respond(status);
      if (message?.type === 'WINGMAN_RETRY') { controller.retry(); respond({ ok: true }); }
    };
    browser.runtime.onMessage.addListener(listener);
    ctx.addEventListener(window, 'keydown', event => {
      const target = event.target;
      const editing = target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
      if (editing || event.repeat) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyW') {
        event.preventDefault();
        toggle();
      } else if (event.isTrusted && event.key === 'ArrowRight') controller.handleManualAction();
    });
    ctx.addEventListener(document, 'click', event => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const next = findNextButton();
      if ((next && next.contains(event.target)) || event.target.closest(STOP_SELECTORS.join(','))) controller.handleManualAction();
    }, { capture: true });

    ctx.onInvalidated(() => {
      controller.destroy();
      tracker.destroy();
      hud.destroy();
      unwatchSettings();
      unwatchStats();
      browser.runtime.onMessage.removeListener(listener);
    });
    tracker.start();
    if (!tracker.current) controller.retry();
    // Reconcile writes that occurred while initial storage reads were pending.
    const latest = await getSettings();
    if (!disposed) { settings = latest; hud.update(settings, stats); controller.updateSettings(settings); }
  },
});
