import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { WingmanSettings, WingmanStats } from '../../modules/types';
import { normalizeStats } from '../../modules/preferences';

interface ExtensionFixture { context: BrowserContext; worker: Worker; popup: Page; site: Page; }

const test = base.extend<{ extension: ExtensionFixture }>({
  extension: async ({}, use) => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'wingman-test-'));
    const extensionPath = path.resolve('dist/chrome-mv3');
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--window-size=1280,900'],
    });
    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      await worker.evaluate(() => chrome.storage.local.set({ wingman_settings: { enabled: false, soundAlertOnMatch: false } }));
      await context.route('https://ome.tv/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <html><head><title>OmeTV fixture</title><style>body{margin:0;background:#ddd;font-family:sans-serif}.fixture{padding:24px}video{width:640px;height:480px;background:#222}.btn{display:inline-block;padding:12px;cursor:pointer}</style></head>
        <body><main class="fixture"><div id="remote-video-wrapper" class="s-stop"><video id="remote-video" autoplay muted playsinline></video></div>
        <div class="start-button"><div class="btn btn-main" role="button" aria-label="Start"
          onclick="if(this.querySelector('[data-tr=next]')){document.body.dataset.clicks=String(Number(document.body.dataset.clicks||0)+1);document.querySelector('#remote-video-wrapper').className='s-search'}">
          <span data-tr="start">Start</span></div></div>
        <div class="stop-button"><button onclick="document.querySelector('#remote-video-wrapper').className='s-stop';document.querySelector('video').srcObject=null">Stop</button></div>
        <input aria-label="Chat message"></main><script>
        window.addEventListener('keydown',event=>{if(event.key==='ArrowRight'&&!event.target.closest('input,textarea'))document.querySelector('.btn-main').click()});
        </script></body></html>` }));
      const site = await context.newPage();
      await site.goto('https://ome.tv/');
      await expect(site.locator('#wingman-hud-root')).toBeAttached();
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
      await site.bringToFront();
      await expect(popup.getByRole('heading', { name: 'Wingman' })).toBeVisible();
      await use({ context, worker, popup, site });
    } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
  },
});

async function getSettings(worker: Worker) {
  return worker.evaluate(async () => (await chrome.storage.local.get('wingman_settings')).wingman_settings as WingmanSettings);
}
async function getStats(worker: Worker) {
  return normalizeStats(await worker.evaluate(async () => (await chrome.storage.local.get('wingman_stats')).wingman_stats as WingmanStats));
}
async function enableTracking(popup: Page) {
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'WINGMAN_MUTATE', mutation: { type: 'settings', patch: { enabled: true } } }));
}
async function connect(site: Page, className = 's-play') {
  await site.evaluate(async className => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    const drawing = canvas.getContext('2d')!;
    drawing.fillStyle = '#777'; drawing.fillRect(0, 0, 320, 240);
    const video = document.querySelector('video')!;
    video.srcObject = canvas.captureStream(5);
    await video.play();
    document.querySelector('#remote-video-wrapper')!.className = className;
    const button = document.querySelector('.btn-main')!;
    button.setAttribute('aria-label', 'Next');
    const label = button.querySelector('span')!;
    label.dataset.tr = 'next'; label.textContent = 'Next';
  }, className);
}

test('preferences persist and sync with isolated in-page controls', async ({ extension: { popup, site, worker } }) => {
  await popup.getByRole('switch', { name: 'Connection sound' }).check();
  await expect.poll(async () => (await getSettings(worker)).soundAlertOnMatch).toBe(true);
  await popup.getByRole('switch', { name: 'In-page controls' }).uncheck();
  await expect(site.locator('#wingman-hud-root')).toBeHidden();
  await popup.getByRole('switch', { name: 'In-page controls' }).check();
  await expect(site.getByRole('button', { name: 'Resume tracking' })).toBeVisible();
  await popup.reload();
  await expect(popup.getByRole('switch', { name: 'Connection sound' })).toBeChecked();
  await expect(popup.getByRole('switch', { name: 'In-page controls' })).toBeChecked();
});

test('shortcut ignores text entry and keeps settings, HUD and badge in sync', async ({ extension: { popup, site, worker } }) => {
  await site.getByLabel('Chat message').fill('hello');
  await site.getByLabel('Chat message').press('Alt+w');
  expect((await getSettings(worker)).enabled).toBe(false);
  await site.getByLabel('Chat message').blur();
  await site.locator('body').press('Alt+w');
  await expect(popup.getByRole('switch', { name: 'Session tracking', exact: true })).toBeChecked();
  await expect(site.getByRole('button', { name: 'Pause tracking' })).toBeVisible();
  await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('ON');
  await site.getByRole('button', { name: 'Pause tracking' }).click();
  await expect(popup.getByRole('switch', { name: 'Session tracking', exact: true })).not.toBeChecked();
  await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('OFF');
});

test('background serializes counter writes and syncs the HUD through reset', async ({ extension: { popup, site, worker } }) => {
  await popup.evaluate(async () => Promise.all(Array.from({ length: 20 }, () =>
    chrome.runtime.sendMessage({ type: 'WINGMAN_MUTATE', mutation: { type: 'manualSkip' } }))));
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(20);
  await expect(popup.getByLabel('Skipped', { exact: true })).toHaveText('20');
  const hud = site.getByRole('complementary', { name: 'Wingman' });
  await expect(hud.locator('.skips strong')).toHaveText('20');
  await popup.getByRole('button', { name: 'Reset statistics' }).click();
  await popup.getByRole('button', { name: 'Cancel reset' }).click();
  await expect(hud.locator('.skips strong')).toHaveText('20');
  await popup.getByRole('button', { name: 'Reset statistics' }).click();
  await popup.getByRole('button', { name: 'Reset all' }).click();
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(0);
  await expect(hud.locator('.skips strong')).toHaveText('0');
  await site.reload();
  await expect(site.getByRole('complementary', { name: 'Wingman' }).locator('.skips strong')).toHaveText('0');
});

test('live sessions and HUD/native/keyboard skips update both displays without classification', async ({ extension: { site, popup, worker } }) => {
  await enableTracking(popup);
  await connect(site, 'video-container__remote-video');
  await expect(site.getByRole('status')).toHaveText('Connected');
  await expect.poll(async () => (await getStats(worker)).totalSessions).toBe(1);
  const hud = site.getByRole('complementary', { name: 'Wingman' });
  await expect(hud.getByLabel('Sessions', { exact: true }).locator('strong')).toHaveText('1');
  await expect(hud.getByLabel('Chat duration')).not.toHaveText('00:00');
  await hud.getByRole('button', { name: 'Next connection' }).click();
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(1);
  await expect(site.locator('body')).toHaveAttribute('data-clicks', '1');
  await expect(site.getByRole('status')).toHaveText('Waiting for next connection');
  await expect(hud.getByRole('button', { name: 'Next connection' })).toBeDisabled();
  await expect(hud.getByLabel('Chat duration')).toHaveText('--:--');

  await connect(site);
  await expect.poll(async () => (await getStats(worker)).totalSessions).toBe(2);
  await site.locator('.btn-main').click();
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(2);
  await expect(popup.getByLabel('Skipped', { exact: true })).toHaveText('2');

  await connect(site);
  await expect.poll(async () => (await getStats(worker)).totalSessions).toBe(3);
  await site.getByLabel('Chat message').press('ArrowRight');
  expect((await getStats(worker)).totalSkipped).toBe(2);
  await site.getByLabel('Chat message').blur();
  await site.locator('body').press('ArrowRight');
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(3);
  expect((await getStats(worker)).totalSessions).toBe(3);

  await connect(site);
  await expect.poll(async () => (await getStats(worker)).totalSessions).toBe(4);
  await expect(popup.getByRole('button', { name: 'Next connection' })).toBeEnabled();
  await popup.getByRole('button', { name: 'Next connection' }).click();
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(4);
  await connect(site);
  await expect.poll(async () => (await getStats(worker)).totalSessions).toBe(5);
  await site.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(site.getByRole('status')).toHaveText('Waiting for next connection');
  expect((await getStats(worker)).totalSkipped).toBe(4);
  await site.reload();
  await expect(popup.getByLabel('Sessions', { exact: true })).toHaveText('5');
  await expect(site.getByRole('complementary', { name: 'Wingman' }).locator('.skips strong')).toHaveText('4');
});

test('failed Next requests do not inflate counters and remain retryable', async ({ extension: { site, popup, worker } }) => {
  await enableTracking(popup);
  await connect(site);
  await expect(site.getByRole('status')).toHaveText('Connected');
  await site.locator('.btn-main').evaluate(element => element.removeAttribute('onclick'));
  const next = site.getByRole('complementary', { name: 'Wingman' }).getByRole('button', { name: 'Next connection' });
  await next.click();
  await expect(next).toBeDisabled();
  await expect(site.getByRole('status')).toHaveText('Next did not change the connection. Try again.');
  expect((await getStats(worker)).totalSkipped).toBe(0);
  await expect(next).toBeEnabled();
  await site.locator('.start-button').evaluate(element => element.classList.add('disabled'));
  await next.click();
  await expect(site.getByRole('status')).toHaveText('Next control unavailable');
  expect((await getStats(worker)).totalSkipped).toBe(0);
});

test('pausing and resuming an active connection does not double count it', async ({ extension: { site, worker } }) => {
  await connect(site);
  await expect(site.getByRole('status')).toHaveText('Session tracking paused');
  expect((await getStats(worker)).totalSessions).toBe(0);
  await site.getByRole('button', { name: 'Resume tracking' }).click();
  await expect.poll(async () => (await getStats(worker)).totalSessions).toBe(1);
  await site.getByRole('button', { name: 'Pause tracking' }).click();
  await site.getByRole('button', { name: 'Resume tracking' }).click();
  expect((await getStats(worker)).totalSessions).toBe(1);
  await site.evaluate(() => { document.querySelector('#remote-video-wrapper')!.className = 's-search'; });
  await expect(site.getByRole('status')).toHaveText('Waiting for next connection');
  expect((await getStats(worker)).totalSkipped).toBe(0);
});

test('settings panel stays wide in a real browser action window', async ({ extension: { context, worker, popup } }, testInfo) => {
  await worker.evaluate(() => chrome.action.openPopup());
  const session = await context.browser()!.newBrowserCDPSession();
  try {
    const { targetInfos } = await session.send('Target.getTargets');
    const target = targetInfos.find(target => target.url === popup.url() && !target.attached);
    expect(target, 'Actual browser action window exists').toBeDefined();
    const { sessionId } = await session.send('Target.attachToTarget', { targetId: target!.targetId, flatten: false });
    // Action windows are not exposed as Playwright pages, so measure the native target.
    let messageId = 0;
    const readLayout = async () => {
      const id = ++messageId;
      const result = new Promise<string>(resolve => {
        const listener = (event: { sessionId: string; message: string }) => {
          if (event.sessionId !== sessionId) return;
          const response = JSON.parse(event.message);
          if (response.id !== id) return;
          session.off('Target.receivedMessageFromTarget', listener);
          resolve(response.result.result.value);
        };
        session.on('Target.receivedMessageFromTarget', listener);
      });
      await session.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({
        id, method: 'Runtime.evaluate', params: { returnByValue: true, expression: `JSON.stringify({
          width: innerWidth, height: innerHeight, contentWidth: document.body.clientWidth,
          ready: !!document.querySelector('.next-button'),
          controlsFit: Array.from(document.querySelectorAll('button,input,select')).every(element => {
            const bounds = element.getBoundingClientRect();
            return bounds.left >= 0 && bounds.right <= innerWidth;
          }),
          scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight
        })` },
      }) });
      return JSON.parse(await result);
    };
    await expect.poll(readLayout).toMatchObject({ contentWidth: 520, ready: true, controlsFit: true });
    const layout = await readLayout();
    expect(layout.width).toBeGreaterThanOrEqual(520);
    expect(layout.width).toBeLessThanOrEqual(535);
    expect(layout.scrollWidth).toBe(layout.width);
    expect(layout.height).toBeLessThanOrEqual(600);
    expect(layout.scrollHeight).toBeLessThanOrEqual(600);
  } finally { await session.detach(); }
  await popup.setViewportSize({ width: 520, height: 600 });
  await popup.locator('main.app').screenshot({ path: testInfo.outputPath('settings-panel.png') });
});

test('larger HUD fits mobile and desktop viewports', async ({ extension: { site, popup } }, testInfo) => {
  await enableTracking(popup);
  await connect(site);
  await expect(site.getByRole('status')).toHaveText('Connected');
  for (const width of [320, 1280]) {
    await site.setViewportSize({ width, height: 800 });
    const hud = site.getByRole('complementary', { name: 'Wingman' });
    const box = (await hud.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.width).toBe(width === 320 ? 288 : 420);
    expect(await hud.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
    await expect(hud.getByRole('button', { name: 'Next connection' })).toBeEnabled();
    await hud.screenshot({ path: testInfo.outputPath(`hud-${width}.png`) });
  }
});
