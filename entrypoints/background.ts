import { type Browser, browser } from 'wxt/browser';
import { sampleTable } from '@/core/sample';
import { type Capture, messageSchema, type Reply, sanitizeSourceUrl } from '@/core/schema';
import { CaptureRepository, type PendingCapture } from '@/extension/repository';

export default defineBackground(() => {
  const repository = new CaptureRepository(browser.storage.session);
  const starting = new Set<number>();
  const trustedPage = (sender: Browser.runtime.MessageSender) => {
    if (sender.id !== browser.runtime.id || !sender.url) return false;
    try {
      const url = new URL(sender.url);
      const root = new URL(browser.runtime.getURL('/'));
      return (
        url.protocol === root.protocol &&
        url.host === root.host &&
        ['/popup.html', '/editor.html'].includes(url.pathname) &&
        (sender.frameId ?? 0) === 0
      );
    } catch {
      return false;
    }
  };

  async function openCapture(table: Capture['table'], source: Capture['source']): Promise<Reply> {
    const capture: Capture = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      table,
      source,
      editorTabId: null,
    };
    await repository.save(capture);
    try {
      const editor = await browser.tabs.create({
        url: browser.runtime.getURL(`/editor.html?id=${capture.id}`),
      });
      if (editor.id !== undefined) await repository.save({ ...capture, editorTabId: editor.id });
      return { ok: true, id: capture.id };
    } catch (error) {
      await repository.remove(capture.id);
      throw error;
    }
  }

  async function start(tabId: number): Promise<Reply> {
    if (starting.has(tabId))
      return { ok: false, error: 'Selection is already starting on this page.' };
    starting.add(tabId);
    try {
      await repository.cancel(tabId);
      const tab = await browser.tabs.get(tabId);
      if (!tab.url || !sanitizeSourceUrl(tab.url))
        return { ok: false, error: 'This page cannot be inspected. Open an ordinary website.' };
      const injection = await browser.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        files: ['/picker.js'],
      });
      const documentId = injection[0]?.documentId;
      if (!documentId)
        return { ok: false, error: 'Could not attach to this page. Refresh it and try again.' };
      const token = crypto.randomUUID();
      await repository.setPending(tabId, {
        token,
        documentId,
        createdAt: Date.now(),
        source: {
          title: (tab.title || 'Untitled page').slice(0, 200),
          url: sanitizeSourceUrl(tab.url),
          tabId,
        },
      });
      await browser.tabs.sendMessage(tabId, { type: 'picker:open', token }, { documentId });
      return { ok: true };
    } catch {
      await repository.cancel(tabId);
      return {
        ok: false,
        error:
          'Cannot access this page. Refresh it, then open TableLyft from the toolbar. Browser pages and extension stores are unsupported.',
      };
    } finally {
      starting.delete(tabId);
    }
  }

  async function handle(value: unknown, sender: Browser.runtime.MessageSender): Promise<Reply> {
    const parsed = messageSchema.safeParse(value);
    if (!parsed.success || sender.id !== browser.runtime.id)
      return { ok: false, error: 'Invalid TableLyft request.' };
    const message = parsed.data;
    if (message.type === 'capture:start') {
      if (!trustedPage(sender))
        return { ok: false, error: 'This command requires a TableLyft page.' };
      return start(message.tabId);
    }
    if (message.type === 'sample:open') {
      if (!trustedPage(sender))
        return { ok: false, error: 'This command requires a TableLyft page.' };
      return openCapture(sampleTable, { title: 'Sample dataset', url: null, tabId: null });
    }
    if (message.type === 'capture:discard') {
      if (!trustedPage(sender))
        return { ok: false, error: 'This command requires a TableLyft page.' };
      await repository.remove(message.id);
      return { ok: true };
    }
    if (sender.tab?.id === undefined || sender.frameId !== 0)
      return { ok: false, error: 'Select a table from its source page.' };
    if (message.type === 'capture:cancel') {
      await repository.cancel(sender.tab.id, message.token);
      return { ok: true };
    }
    let pending: PendingCapture;
    try {
      pending = await repository.consume(
        sender.tab.id,
        sender.documentId,
        sender.frameId,
        message.token,
      );
    } catch {
      return {
        ok: false,
        error: 'Selection access expired. Open TableLyft on the source page again.',
      };
    }
    return openCapture(message.table, pending.source);
  }

  browser.runtime.onMessage.addListener((message, sender, respond) => {
    void handle(message, sender)
      .then(respond)
      .catch(() =>
        respond({
          ok: false,
          error: 'Capture could not be saved. Close unused TableLyft workspaces and try again.',
        }),
      );
    return true;
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void repository.removeForEditor(tabId).catch(() => {});
    void repository.cancel(tabId).catch(() => {});
  });
});
