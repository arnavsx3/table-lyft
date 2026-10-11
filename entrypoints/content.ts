import { getSettings, saveSettings, getStats, recordSkip, recordMatch, onSettingsChanged, onStatsChanged } from '@/modules/storage';
import { OmePartnerDetector } from '@/modules/ometv/detector';
import { OmeSkipper } from '@/modules/ometv/skipper';
import { WingmanInPageHud } from '@/modules/ometv/hud';
import { OmeAiVisionDetector } from '@/modules/ometv/vision';
import type { PartnerDetectedEvent, WingmanSettings, WingmanStats } from '@/modules/types';

export default defineContentScript({
  matches: [
    '*://*.ome.tv/*',
    '*://ome.tv/*',
    '*://*.minichat.com/*',
    '*://minichat.com/*'
  ],
  runAt: 'document_idle',
  async main() {
    console.log('[Wingman] Content script loaded on OmeTV.');

    let settings: WingmanSettings = await getSettings();
    let stats: WingmanStats = await getStats();

    const detector = new OmePartnerDetector();
    const skipper = new OmeSkipper();
    const hud = new WingmanInPageHud();
    const vision = new OmeAiVisionDetector();

    // Initialize in-page HUD
    hud.init(async () => {
      const newEnabled = !settings.enabled;
      settings = await saveSettings({ enabled: newEnabled });
      hud.update(settings, stats);
      hud.setStatusText(settings.enabled ? 'Active' : 'Paused', settings.enabled ? '#10b981' : '#64748b');
    });
    hud.update(settings, stats);
    hud.setStatusText('Loading AI...', '#c4b5fd');

    // React to settings changes in real-time
    onSettingsChanged((newSettings) => {
      settings = newSettings;
      hud.update(settings, stats);
      hud.setStatusText(settings.enabled ? 'Active' : 'Paused', settings.enabled ? '#10b981' : '#64748b');
    });

    // React to stats changes
    onStatsChanged((newStats) => {
      stats = newStats;
      hud.update(settings, stats);
    });

    const handlePartnerEvent = async (event: PartnerDetectedEvent) => {
      if (!settings.enabled) return;

      console.log(`[Wingman] Partner detected: [${event.gender.toUpperCase()}] via ${event.source}`);

      if (event.gender === 'male' && settings.targetGender === 'girls_only') {
        hud.setStatusText('Male ➔ Skipping...', '#f87171');
        console.log('[Wingman] Male partner detected. Scheduling humanized skip...');

        const skipped = await skipper.skipPartner(settings, () => {
          console.log('[Wingman] Skip action fired successfully.');
        });

        if (skipped) {
          stats = await recordSkip(true);
          hud.update(settings, stats);
          setTimeout(() => hud.setStatusText('Searching...', '#94a3b8'), 800);
        }
      } else if (event.gender === 'female') {
        hud.setStatusText('💖 Girl Matched!', '#34d399');
        console.log('[Wingman] Female partner matched! Preserving connection.');
        stats = await recordMatch(true);
        hud.update(settings, stats);

        if (settings.soundAlertOnMatch) {
          skipper.playMatchSound();
        }
      }
    };

    // 1. Text/WebSocket/DOM detection
    detector.start(handlePartnerEvent);

    // 2. Real-time AI Face & Gender Vision detection on #remote-video
    await vision.init((event) => {
      handlePartnerEvent(event);
    });
    hud.setStatusText('Active (AI Ready)', '#10b981');

    // Keyboard shortcut (Alt + W) to quickly toggle Wingman
    window.addEventListener('keydown', async (e) => {
      if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        const updated = await saveSettings({ enabled: !settings.enabled });
        settings = updated;
        hud.update(settings, stats);
        hud.setStatusText(settings.enabled ? 'Active' : 'Paused', settings.enabled ? '#10b981' : '#64748b');
        console.log(`[Wingman] Toggled state to: ${settings.enabled ? 'ACTIVE' : 'PAUSED'}`);
      }
    });
  }
});
