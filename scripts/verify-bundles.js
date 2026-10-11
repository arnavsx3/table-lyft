import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const browser of ['chrome', 'firefox']) {
  const root = path.resolve(`dist/${browser}-mv3`);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, pkg.version);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.content_scripts.length, 1, 'Only the isolated content script should be injected');
  assert.ok(manifest.content_scripts.every(script => !script.world || script.world === 'ISOLATED'));
  assert.ok(manifest.host_permissions.every(host => /ome\.tv|minichat\.com/.test(host)));
  if (browser === 'firefox') assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
  for (const name of ['tiny_face_detector', 'age_gender']) {
    const groups = JSON.parse(await readFile(path.join(root, `models/${name}_model-weights_manifest.json`), 'utf8'));
    for (const group of groups) {
      let actual = 0;
      for (const file of group.paths) actual += (await stat(path.join(root, 'models', file))).size;
      const expected = group.weights.reduce((sum, weight) => {
        const type = weight.quantization?.dtype ?? weight.dtype;
        const bytes = { float32: 4, int32: 4, bool: 1, uint8: 1, uint16: 2 }[type];
        assert.ok(bytes, `Unsupported weight type: ${type}`);
        return sum + weight.shape.reduce((size, dimension) => size * dimension, 1) * bytes;
      }, 0);
      assert.equal(actual, expected, `${name} model shards must match their weight manifest`);
    }
  }
  const scripts = [...manifest.content_scripts.flatMap(script => script.js),
    ...(manifest.background.scripts ?? [manifest.background.service_worker])];
  for (const file of [...scripts, manifest.action.default_popup, 'THIRD_PARTY_NOTICES.txt']) assert.ok((await stat(path.join(root, file))).size > 0);
  console.log(`${browser}: MV3 manifest, permissions, scripts, popup and model weights verified`);
}
