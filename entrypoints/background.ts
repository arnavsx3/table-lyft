import { getSettings, onSettingsChanged } from '@/modules/storage';

export default defineBackground(() => {
  console.log('[Wingman] Background service worker initialized.');

  async function updateBadge(enabled: boolean) {
    try {
      if (enabled) {
        await chrome.action.setBadgeText({ text: 'ON' });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      } else {
        await chrome.action.setBadgeText({ text: 'OFF' });
        await chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
      }
    } catch {
      // Ignored if action is not ready
    }
  }

  // Set initial badge state
  getSettings().then((settings) => {
    updateBadge(settings.enabled);
  });

  // Watch for toggle updates
  onSettingsChanged((settings) => {
    updateBadge(settings.enabled);
  });
});
