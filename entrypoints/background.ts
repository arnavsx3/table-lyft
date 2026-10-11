import { browser } from 'wxt/browser';
import { getSettings, onSettingsChanged } from '@/modules/storage';
import { createStorageService, isMutation } from '@/modules/storage-service';

export default defineBackground(() => {
  const mutate = createStorageService(browser.storage.local);
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || message?.type !== 'WINGMAN_MUTATE') return;
    if (!isMutation(message.mutation)) {
      sendResponse({ ok: false, error: 'Invalid settings request.' });
      return;
    }
    mutate(message.mutation).then(
      value => sendResponse({ ok: true, value }),
      () => sendResponse({ ok: false, error: 'Could not save changes. Please try again.' }),
    );
    return true;
  });

  const updateBadge = async (settings: Awaited<ReturnType<typeof getSettings>>) => {
    const active = settings.enabled;
    await browser.action.setBadgeText({ text: active ? 'ON' : 'OFF' });
    await browser.action.setBadgeBackgroundColor({ color: active ? '#13866b' : '#6b7280' });
  };
  getSettings().then(updateBadge).catch(console.error);
  onSettingsChanged(settings => { void updateBadge(settings).catch(console.error); });
});
