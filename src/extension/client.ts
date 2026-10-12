import type { Capture, Reply, RuntimeMessage } from '../core/schema';
import { CaptureRepository } from './repository';

export const isExtension = () =>
  ['chrome-extension:', 'moz-extension:'].includes(location.protocol);

export async function extensionApi() {
  if (!isExtension()) throw new Error('This command requires the installed extension.');
  return (await import('wxt/browser')).browser;
}

export async function send(message: RuntimeMessage): Promise<Reply> {
  const api = await extensionApi();
  const reply = (await api.runtime.sendMessage(message)) as Reply | undefined;
  if (!reply || typeof reply.ok !== 'boolean')
    throw new Error('TableLyft did not respond. Reload the extension.');
  return reply;
}

export async function loadCapture(id: string): Promise<Capture | null> {
  const api = await extensionApi();
  return new CaptureRepository(api.storage.session).load(id);
}

export async function goToSource(tabId: number) {
  const api = await extensionApi();
  const tab = await api.tabs.get(tabId);
  if (tab.windowId !== undefined) await api.windows.update(tab.windowId, { focused: true });
  await api.tabs.update(tabId, { active: true });
}
