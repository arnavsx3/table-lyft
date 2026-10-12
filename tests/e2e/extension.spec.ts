import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type BrowserContext, test as base, chromium, expect, type Page } from '@playwright/test';
import Papa from 'papaparse';
import type { browser } from 'wxt/browser';

type Api = typeof browser;
type Extension = {
  context: BrowserContext;
  popup: Page;
  source: Page;
  id: string;
  origin: string;
  start: () => Promise<void>;
  capture: (name?: string) => Promise<Page>;
};

const fixture = (path: string) => {
  const rows = Array.from(
    { length: 230 },
    (_, i) => `<tr><td>Item ${i + 1}</td><td>${i}</td></tr>`,
  ).join('');
  const table = path.startsWith('/empty')
    ? '<p>No table on this page.</p>'
    : path.startsWith('/many')
      ? `<table><caption>Inventory</caption><tr><th>Item</th><th>Value</th></tr>${rows}</table>`
      : path.startsWith('/large')
        ? '<table><caption>Oversized</caption><tr><td colspan="101">Large</td></tr></table>'
        : `<table id="report"><caption>Quarterly revenue</caption>
          <thead><tr><th rowspan="2">Region</th><th colspan="2">Sales</th></tr><tr><th>Q1</th><th>Q2</th></tr></thead>
          <tbody><tr><td>North <span hidden>private</span><input value="secret"></td><td>10</td><td>20</td></tr>
          <tr><td>South</td><td>30</td><td>=2+2</td></tr><tr><td>West</td><td>05</td><td>40</td></tr>
          <tr hidden><td>Hidden</td><td>0</td><td>0</td></tr></tbody></table>`;
  return `<!doctype html><html lang="en"><head><title>Fixture report</title><meta charset="utf-8">
    <style>body{font:16px system-ui;padding:32px;background:#fafafa}table{border-collapse:collapse;background:white}td,th{padding:12px 24px;border:1px solid #ccc}caption{padding:16px;text-align:left;font-weight:600}</style>
    </head><body><h1>Reports</h1>${table}</body></html>`;
};

const test = base.extend<{ extension: Extension }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture arguments.
  extension: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'tablelyft-test-'));
    const extensionPath = join(directory, 'extension');
    await cp(resolve('.output/chrome-mv3'), extensionPath, { recursive: true });
    const manifestPath = join(extensionPath, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    // Only this disposable test copy receives a host grant, replacing the toolbar gesture.
    manifest.host_permissions = ['http://127.0.0.1/*'];
    await writeFile(manifestPath, JSON.stringify(manifest));
    const server = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(fixture(request.url ?? '/'));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    let context: BrowserContext | undefined;
    try {
      context = await chromium.launchPersistentContext(join(directory, 'profile'), {
        channel: 'chromium',
        headless: true,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          '--no-sandbox',
        ],
        viewport: { width: 1440, height: 960 },
        acceptDownloads: true,
      });
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
      const id = new URL(worker.url()).host;
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${id}/popup.html`);
      const source = await context.newPage();
      await source.goto(`${origin}/report?token=not-retained#private`);
      const start = async () => {
        const tabs = await worker.evaluate(() =>
          (globalThis as unknown as { chrome: Api }).chrome.tabs.query({}),
        );
        const tab = tabs.find((tab) => tab.url === source.url());
        if (!tab?.id) throw new Error('Fixture tab not found');
        const reply = await popup.evaluate(
          async (tabId) =>
            (globalThis as unknown as { chrome: Api }).chrome.runtime.sendMessage({
              type: 'capture:start',
              tabId,
            }),
          tab.id,
        );
        expect(reply).toEqual({ ok: true });
        await expect(source.getByRole('dialog', { name: 'Select a table' })).toBeVisible();
      };
      const capture = async (name = 'Quarterly revenue') => {
        await start();
        const next = context!.waitForEvent('page');
        await source.getByRole('button', { name: new RegExp(name) }).click();
        const editor = await next;
        await expect(editor.getByRole('heading', { name, exact: true })).toBeVisible();
        return editor;
      };
      await use({ context, popup, source, id, origin, start, capture });
    } finally {
      await context?.close();
      await new Promise<void>((done, fail) =>
        server.close((error) => (error ? fail(error) : done())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  },
});

async function download(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await pending;
  const path = await file.path();
  if (!path) throw new Error('Download missing');
  return { filename: file.suggestedFilename(), text: await readFile(path, 'utf8') };
}

test('capture, preview and exported bytes agree', async ({ extension }) => {
  const { source, capture } = extension;
  await expect(source.locator('[data-tablelyft-picker]')).toHaveCount(0);
  const editor = await capture();
  await expect(source.locator('[data-tablelyft-picker]')).toHaveCount(0);
  await expect(editor.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await expect(editor.getByRole('table')).not.toContainText('private');
  await expect(
    editor.getByRole('button', { name: 'Sort by Sales / Q1', exact: true }),
  ).toBeVisible();
  await expect(editor.locator('.source-line a')).toHaveAttribute(
    'href',
    `${extension.origin}/report`,
  );
  const file = await download(editor);
  expect(file.filename).toBe('Quarterly revenue.csv');
  expect(file.text.charCodeAt(0)).toBe(0xfeff);
  expect(Papa.parse<string[]>(file.text).data).toEqual([
    ['Region', 'Sales / Q1', 'Sales / Q2'],
    ['North', '10', '20'],
    ['South', '30', "'=2+2"],
    ['West', '05', '40'],
  ]);
  await editor.getByRole('textbox', { name: 'Rename column 1' }).fill('Area');
  await editor.getByRole('checkbox', { name: 'Include column 2', exact: true }).uncheck();
  await editor.getByRole('searchbox', { name: 'Filter rows' }).fill('south');
  expect(Papa.parse<string[]>((await download(editor)).text).data).toEqual([
    ['Area', 'Sales / Q2'],
    ['South', "'=2+2"],
  ]);
  await editor.getByRole('checkbox', { name: 'Protect spreadsheet formulas' }).uncheck();
  await editor.getByLabel('CSV separator').selectOption(';');
  expect(Papa.parse<string[]>((await download(editor)).text, { delimiter: ';' }).data).toEqual([
    ['Area', 'Sales / Q2'],
    ['South', '=2+2'],
  ]);
  await editor.getByRole('searchbox').fill('nothing-matches');
  await expect(editor.getByRole('heading', { name: 'No matching rows' })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();
  await editor.getByRole('button', { name: 'Reset changes' }).click();
  await expect(editor.getByRole('table').locator('tbody tr')).toHaveCount(3);
  await expect(
    editor.getByRole('checkbox', { name: 'Protect spreadsheet formulas' }),
  ).toBeChecked();
  await editor.getByRole('button', { name: 'Sort by Sales / Q1', exact: true }).click();
  await expect(editor.getByRole('table').locator('tbody tr').first()).toContainText('West');
  await editor.reload();
  await expect(editor.getByRole('table').locator('tbody tr').first()).toContainText('North');
});

test('pagination exports all filtered rows, not just the visible page', async ({ extension }) => {
  await extension.source.goto(`${extension.origin}/many`);
  const editor = await extension.capture('Inventory');
  await expect(editor.getByRole('table').locator('tbody tr')).toHaveCount(100);
  await editor.getByRole('button', { name: 'Next page' }).click();
  await expect(editor.getByRole('table').locator('tbody tr').first()).toContainText('Item 101');
  expect(Papa.parse<string[]>((await download(editor)).text).data).toHaveLength(231);
  await editor.getByRole('button', { name: 'Next page' }).click();
  await expect(editor.getByRole('table').locator('tbody tr')).toHaveCount(30);
  await editor.getByRole('searchbox').fill('Item 230');
  await expect(editor.getByRole('table').locator('tbody tr')).toHaveCount(1);
});

test('picker cancels, reopens, and reports empty, detached and oversized tables', async ({
  extension,
}, testInfo) => {
  await extension.start();
  await extension.source.screenshot({ path: testInfo.outputPath('picker.png') });
  await extension.source.keyboard.press('Escape');
  await expect(extension.source.locator('[data-tablelyft-picker]')).toHaveCount(0);
  await extension.start();
  await extension.source.locator('#report').evaluate((node) => node.remove());
  await extension.source.getByRole('button', { name: /Quarterly revenue/ }).click();
  await expect(extension.source.getByRole('alert')).toContainText('no longer on the page');
  await extension.source.goto(`${extension.origin}/empty`);
  await extension.start();
  await expect(extension.source.getByText('No HTML tables found')).toBeVisible();
  await extension.source.goto(`${extension.origin}/large`);
  await extension.start();
  await extension.source.getByRole('button', { name: /Oversized/ }).click();
  await expect(extension.source.getByRole('alert')).toContainText('100-column limit');
});

test('sample, clipboard, responsive workspace and discard', async ({ extension }, testInfo) => {
  const errors: string[] = [];
  const next = extension.context.waitForEvent('page');
  await extension.popup.setViewportSize({ width: 384, height: 500 });
  await extension.popup.screenshot({ path: testInfo.outputPath('popup.png') });
  await extension.popup.getByRole('button', { name: 'Open sample' }).click();
  const editor = await next;
  editor.on('pageerror', (error) => errors.push(error.message));
  await expect(editor.getByRole('heading', { name: 'Outdoor gear comparison' })).toBeVisible();
  await editor.getByRole('button', { name: 'Copy spreadsheet' }).click();
  await expect(editor.getByRole('status')).toContainText('Copied 16 rows');
  await editor.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('Copied 16 rows');
  await extension.context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: extension.origin,
  });
  await extension.source.bringToFront();
  expect(await extension.source.evaluate(() => navigator.clipboard.readText())).toContain(
    '| Product | Category |',
  );
  await editor.bringToFront();
  await editor.getByRole('button', { name: 'Copy spreadsheet' }).click();
  await extension.source.bringToFront();
  await expect
    .poll(() => extension.source.evaluate(() => navigator.clipboard.readText()))
    .toContain('Product\tCategory\tWeight');
  await extension.context.clearPermissions();
  await editor.bringToFront();
  for (const width of [1440, 1280, 768, 390, 320]) {
    await editor.setViewportSize({ width, height: 900 });
    expect(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(editor.getByRole('button', { name: 'Copy spreadsheet' })).toBeVisible();
    await editor.screenshot({
      path: testInfo.outputPath(`workspace-${width}.png`),
      fullPage: true,
    });
  }
  await editor.getByRole('checkbox', { name: 'Include column 1', exact: true }).uncheck();
  await editor.getByRole('button', { name: 'Include all columns', exact: true }).click();
  await editor.getByLabel('Heading rows').fill('0');
  await expect(editor.getByRole('table').locator('tbody tr')).toHaveCount(17);
  editor.once('dialog', (dialog) => dialog.accept());
  await editor.getByRole('button', { name: 'Discard capture' }).click();
  await expect(editor.getByRole('heading', { name: 'No active capture' })).toBeVisible();
  await editor.reload();
  await expect(editor.getByRole('heading', { name: 'No active capture' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('direct table selection, zero columns and plain-text rendering', async ({ extension }) => {
  await extension.source
    .locator('#report td')
    .first()
    .evaluate((cell) => {
      cell.textContent = '<img src=x onerror=alert(1)> <script>bad()</script>';
    });
  await extension.start();
  const next = extension.context.waitForEvent('page');
  await extension.source.locator('#report td').first().click();
  const editor = await next;
  await expect(editor.getByRole('table')).toContainText('<img src=x onerror=alert(1)>');
  await expect(editor.getByRole('table').locator('img,script')).toHaveCount(0);
  for (let column = 1; column <= 3; column++) {
    await editor.getByRole('checkbox', { name: `Include column ${column}`, exact: true }).uncheck();
  }
  await expect(editor.getByRole('heading', { name: 'No columns selected' })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Copy spreadsheet' })).toBeDisabled();
  await editor.getByRole('button', { name: 'Include all columns', exact: true }).last().click();
  await expect(editor.getByRole('table')).toBeVisible();
});

test('closed editor and expired capture cannot be restored', async ({ extension }) => {
  const editor = await extension.capture();
  const url = editor.url();
  await editor.close();
  const worker = extension.context.serviceWorkers()[0]!;
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const data = await (globalThis as unknown as { chrome: Api }).chrome.storage.session.get(
          null,
        );
        return Object.keys(data).filter((key) => key.startsWith('tablelyft:capture:')).length;
      }),
    )
    .toBe(0);
  const reopened = await extension.context.newPage();
  await reopened.goto(url);
  await expect(reopened.getByRole('heading', { name: 'No active capture' })).toBeVisible();
  const fresh = await extension.capture();
  await worker.evaluate(async () => {
    const api = (globalThis as unknown as { chrome: Api }).chrome;
    const data = await api.storage.session.get(null);
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('tablelyft:capture:'))
        await api.storage.session.set({
          [key]: { ...(value as Record<string, unknown>), createdAt: Date.now() - 1800001 },
        });
    }
  });
  await fresh.reload();
  await expect(fresh.getByRole('heading', { name: 'No active capture' })).toBeVisible();
});
