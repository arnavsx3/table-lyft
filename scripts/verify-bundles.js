import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const browser of ['chrome', 'firefox']) {
  const root = path.resolve(`dist/${browser}-mv3`);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, pkg.version);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.content_scripts.length, 2, 'Isolated controls and a dormant page-world diagnostic bridge');
  assert.equal(manifest.content_scripts.filter(script => !script.world || script.world === 'ISOLATED').length, 1);
  const bridge = manifest.content_scripts.find(script => script.world === 'MAIN');
  assert.ok(bridge && bridge.matches.every(host => /ome\.tv/.test(host)), 'Partner diagnostic bridge is OmeTV-only');
  assert.ok(manifest.host_permissions.every(host => /ome\.tv|minichat\.com/.test(host)));
  if (browser === 'firefox') assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
  assert.ok(!(await readdir(root)).includes('models'), 'Manual-control builds must not ship model weights');
  const scripts = [...manifest.content_scripts.flatMap(script => script.js),
    ...(manifest.background.scripts ?? [manifest.background.service_worker])];
  for (const file of [...scripts, manifest.action.default_popup, 'THIRD_PARTY_NOTICES.txt']) assert.ok((await stat(path.join(root, file))).size > 0);
  for (const file of manifest.content_scripts.flatMap(script => script.js)) {
    const source = await readFile(path.join(root, file), 'utf8');
    assert.ok(!/withAgeAndGender|ageGenderNet|tinyFaceDetector/.test(source), 'No video classification in the active content script');
  }
  console.log(`${browser}: MV3, permissions, controls, OmeTV diagnostic bridge and absence of inference/models verified`);
}
