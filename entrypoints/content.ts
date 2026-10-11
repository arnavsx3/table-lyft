import { getSettings, saveSettings, getStats, recordSkip, recordMatch, onSettingsChanged, onStatsChanged } from '@/modules/storage';
import { OmePartnerDetector } from '@/modules/ometv/detector';
import { OmeSkipper } from '@/modules/ometv/skipper';
import { WingmanInPageHud } from '@/modules/ometv/hud';
import { PartnerDetectedEvent, WingmanSettings, WingmanStats } from '@/modules/types';

export default defineContentScript({
  matches: ['*://*.ome.tv/*', '*://ome.tv/*'],
  runAt: 'document_idle',
  async main() {
    console.log('[Wingman] Content script loaded on OmeTV.');

    let settings: WingmanSettings = await getSettings();
    let stats: WingmanStats = await getStats();

    const detector = new OmePartnerDetector();
    const skipper = new OmeSkipper();
    const hud = new WingmanInPageHud();

    // Initialize in-page HUD
    hud.init(async () => {
      // Toggle enabled state from HUD
      const newEnabled = !settings.enabled;
      settings = await saveSettings({ enabled: newEnabled });
      hud.update(settings, stats);
    });
    hud.update(settings, stats);

    // React to settings changes in real-time
    onSettingsChanged((newSettings) => {
      settings = newSettings;
      hud.update(settings, stats);
      console.log('[Wingman] Settings updated:', settings);
    });

    // React to stats changes
    onStatsChanged((newStats) => {
      stats = newStats;
      hud.update(settings, stats);
    });

    // Listen for partner detection
    detector.start(async (event: PartnerDetectedEvent) => {
      if (!settings.enabled) return;

      console.log(`[Wingman] Partner detected: [${event.gender.toUpperCase()}] via ${event.source}`);

      if (event.gender === 'male' && settings.targetGender === 'girls_only') {
        console.log('[Wingman] Male partner detected. Scheduling humanized skip...');
        const skipped = await skipper.skipPartner(settings, () => {
          console.log('[Wingman] Skip action fired successfully.');
        });

        if (skipped) {
          stats = await recordSkip(true);
          hud.update(settings, stats);
        }
      } else if (event.gender === 'female') {
        console.log('[Wingman] Female partner matched! Preserving connection.');
        stats = await recordMatch(true);
        hud.update(settings, stats);

        if (settings.soundAlertOnMatch) {
          skipper.playMatchSound();
        }
      }
    });

    // Keyboard shortcut (Alt + W) to quickly toggle Wingman
    window.addEventListener('keydown', async (e) => {
      if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        const updated = await saveSettings({ enabled: !settings.enabled });
        settings = updated;
        hud.update(settings, stats);
        console.log(`[Wingman] Toggled state to: ${settings.enabled ? 'ACTIVE' : 'PAUSED'}`);
      }
    });
  }
});
