import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve('.output/chrome-mv3');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, 'TableLyft');
assert.deepEqual([...manifest.permissions].sort(), [
  'activeTab',
  'clipboardWrite',
  'scripting',
  'storage',
]);
for (const key of [
  'host_permissions',
  'optional_host_permissions',
  'content_scripts',
  'externally_connectable',
  'web_accessible_resources',
]) {
  assert.equal(manifest[key], undefined, `Unexpected manifest capability: ${key}`);
}
assert.equal(
  manifest.content_security_policy.extension_pages,
  "script-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'none'",
);
assert.equal(manifest.action.default_popup, 'popup.html');
assert.equal(manifest.background.service_worker, 'background.js');
for (const file of [
  'popup.html',
  'editor.html',
  'background.js',
  'picker.js',
  'icon-16.png',
  'icon-32.png',
  'icon-48.png',
  'icon-128.png',
]) {
  await access(join(root, file));
}
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await inspect(path);
    else if (/\.(js|html|css)$/.test(item.name)) {
      const text = await readFile(path, 'utf8');
      assert.doesNotMatch(
        text,
        /(?:<script[^>]+src=["']|importScripts\(["']|import\(["'])https?:/i,
        `Remote code in ${path}`,
      );
      assert.doesNotMatch(
        text,
        /\beval\s*\(|\bnew\s+Function\s*\(/,
        `Dynamic code execution in ${path}`,
      );
    }
  }
}
await inspect(root);
console.log(
  'Production bundle verified: MV3, four expected permissions, packaged entrypoints, strict CSP, no remote executable references.',
);
