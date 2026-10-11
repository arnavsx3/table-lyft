import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { WingmanSettings, WingmanStats } from '../../modules/types';

interface ExtensionFixture { context: BrowserContext; worker: Worker; popup: Page; site: Page; }

const test = base.extend<{ extension: ExtensionFixture }>({
  extension: async ({}, use) => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'wingman-test-'));
    const extensionPath = path.resolve('dist/chrome-mv3');
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--window-size=1280,900', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      await worker.evaluate(() => chrome.storage.local.set({ wingman_settings: { enabled: false, soundAlertOnMatch: false } }));
      await context.route('https://ome.tv/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <html><head><title>OmeTV fixture</title><style>body{margin:0;background:#ddd;font-family:sans-serif}.fixture{padding:24px}video{width:640px;height:480px;background:#222}button{padding:10px}</style></head>
        <body><main class="fixture"><div id="remote-video-wrapper" class="s-stop"><video id="remote-video" autoplay muted playsinline></video></div>
        <div class="start-button"><div class="btn btn-main"><span data-tr="start">Start</span></div></div>
        <button class="next" onclick="document.body.dataset.clicks=String(Number(document.body.dataset.clicks||0)+1);document.querySelector('#remote-video-wrapper').className='s-search'">Next</button>
        <button data-action="stop">Stop</button><input aria-label="Chat message"></main></body></html>` }));
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
  return worker.evaluate(async () => (await chrome.storage.local.get('wingman_stats')).wingman_stats as WingmanStats);
}

test('popup preferences persist and sync with isolated in-page controls', async ({ extension: { popup, site, worker } }) => {
  await popup.getByRole('button', { name: 'Men', exact: true }).click();
  await expect.poll(async () => (await getSettings(worker)).targetGender).toBe('boys_only');
  await popup.getByRole('switch', { name: 'Match sound' }).check();
  await expect.poll(async () => (await getSettings(worker)).soundAlertOnMatch).toBe(true);
  await popup.getByRole('switch', { name: 'In-page controls' }).uncheck();
  await expect(site.locator('#wingman-hud-root')).toBeHidden();
  await popup.getByRole('switch', { name: 'In-page controls' }).check();
  await expect(site.getByRole('button', { name: 'Resume filtering' })).toBeVisible();
  await popup.getByRole('checkbox', { name: 'Skip uncertain matches' }).check();
  await popup.getByLabel('Wait before skipping').selectOption('5000');
  await expect.poll(async () => (await getSettings(worker)).unknownTimeoutMs).toBe(5000);
  await popup.getByRole('slider', { name: 'Confidence threshold' }).focus();
  await popup.getByRole('slider', { name: 'Confidence threshold' }).press('ArrowRight');
  await expect.poll(async () => (await getSettings(worker)).minimumConfidence).toBe(0.86);
  await popup.reload();
  await expect(popup.getByRole('button', { name: 'Men', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(popup.getByRole('checkbox', { name: 'Skip uncertain matches' })).toBeChecked();
});

test('shortcut ignores text entry and keeps popup, HUD and badge in sync', async ({ extension: { popup, site, worker } }) => {
  await site.getByLabel('Chat message').fill('hello');
  await site.getByLabel('Chat message').press('Alt+w');
  expect((await getSettings(worker)).enabled).toBe(false);
  await site.getByLabel('Chat message').blur();
  await site.locator('body').press('Alt+w');
  await expect(popup.getByRole('switch', { name: 'Auto-skip', exact: true })).toBeChecked();
  await expect(site.getByRole('button', { name: 'Pause filtering' })).toBeVisible();
  await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('ON');
  await site.getByRole('button', { name: 'Pause filtering' }).click();
  await expect(popup.getByRole('switch', { name: 'Auto-skip', exact: true })).not.toBeChecked();
  await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('OFF');
  await popup.getByRole('button', { name: 'Everyone' }).click();
  await popup.getByRole('switch', { name: 'Auto-skip', exact: true }).check();
  await expect.poll(() => worker.evaluate(() => chrome.action.getBadgeText({}))).toBe('OFF');
});

test('background serializes counter writes and syncs the HUD through reset', async ({ extension: { popup, site, worker } }) => {
  await popup.evaluate(async () => Promise.all(Array.from({ length: 20 }, () =>
    chrome.runtime.sendMessage({ type: 'WINGMAN_MUTATE', mutation: { type: 'skip', gender: 'male' } }))));
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(20);
  await expect(popup.locator('.stats').getByText('20', { exact: true })).toBeVisible();
  const hud = site.getByRole('complementary', { name: 'Wingman' });
  await expect(hud.getByText('Skipped 20', { exact: true })).toBeVisible();
  await popup.getByRole('button', { name: 'Reset statistics' }).click();
  await popup.getByRole('button', { name: 'Cancel reset' }).click();
  await expect(popup.locator('.stats').getByText('20', { exact: true })).toBeVisible();
  await popup.getByRole('button', { name: 'Reset statistics' }).click();
  await popup.getByRole('button', { name: 'Reset all' }).click();
  await expect.poll(async () => (await getStats(worker)).totalSkipped).toBe(0);
  await expect(hud.getByText('Skipped 0', { exact: true })).toBeVisible();
  await site.reload();
  await expect(site.getByRole('complementary', { name: 'Wingman' }).getByText('Skipped 0', { exact: true })).toBeVisible();
});

test('real bundled models handle a blank stream as unknown and skip only when enabled', async ({ extension: { site, popup, worker } }) => {
  await site.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    const drawing = canvas.getContext('2d')!;
    drawing.fillStyle = '#777'; drawing.fillRect(0, 0, 320, 240);
    const video = document.querySelector('video')!;
    video.srcObject = canvas.captureStream(5);
    await video.play();
    document.querySelector('#remote-video-wrapper')!.className = 's-play';
  });
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'WINGMAN_MUTATE', mutation: {
    type: 'settings', patch: { enabled: true, unknownTimeoutMs: 3000 },
  } }));
  await site.bringToFront();
  await expect(site.getByRole('status')).toHaveText('Uncertain match kept', { timeout: 20000 });
  expect(await site.locator('body').getAttribute('data-clicks')).toBeNull();
  await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'WINGMAN_MUTATE', mutation: {
    type: 'settings', patch: { skipUnknown: true },
  } }));
  await expect(site.locator('body')).toHaveAttribute('data-clicks', '1');
  await expect.poll(async () => (await getStats(worker)).unknownSkipped).toBe(1);
  expect((await getStats(worker)).malesSkipped).toBe(0);
  await expect(popup.locator('.stats .rose')).toHaveText('1');
});

test('settings panel stays wide in a real browser action window', async ({ extension: { context, worker, popup } }, testInfo) => {
  await popup.getByRole('checkbox', { name: 'Skip uncertain matches' }).check();
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
          ready: !!document.querySelector('#uncertain:checked'),
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
    expect(layout.width).toBeLessThanOrEqual(535); // Native scrollbar on shorter displays.
    expect(layout.scrollWidth).toBe(layout.width);
    expect(layout.height).toBeLessThanOrEqual(600);
    expect(layout.scrollHeight).toBeLessThanOrEqual(600);
  } finally { await session.detach(); }
  await popup.setViewportSize({ width: 520, height: 600 });
  await popup.screenshot({ path: testInfo.outputPath('settings-panel.png'), fullPage: true });
});

test('HUD fits mobile and desktop viewports', async ({ extension: { site } }, testInfo) => {
  for (const width of [320, 1280]) {
    await site.setViewportSize({ width, height: 800 });
    const hud = site.getByRole('complementary', { name: 'Wingman' });
    const box = (await hud.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await hud.screenshot({ path: testInfo.outputPath(`hud-${width}.png`) });
  }
});
