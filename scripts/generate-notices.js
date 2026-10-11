import { readFile, writeFile } from 'node:fs/promises';

const packages = ['@vladmandic/face-api', 'react', 'react-dom', 'scheduler', 'lucide-react'];
const sections = ['Wingman third-party notices\n\nModel weights: public/models, from FaceAPI.\nFaceAPI includes TensorFlow.js (Apache-2.0).\n'];
for (const name of packages) {
  const root = `node_modules/${name}`;
  const pkg = JSON.parse(await readFile(`${root}/package.json`, 'utf8'));
  const license = await readFile(`${root}/LICENSE`, 'utf8');
  sections.push(`${name} ${pkg.version}\n${license}`);
}
const mit = await readFile('node_modules/react/LICENSE', 'utf8');
sections.push(`WXT and @wxt-dev/browser - https://github.com/wxt-dev/wxt\n${mit.replace(/Copyright[^\n]+/, 'Copyright (c) 2023 Aaron')}`);
sections.push(`Original face-api.js and model weights - https://github.com/justadudewhohacks/face-api.js\n${mit.replace(/Copyright[^\n]+/, 'Copyright (c) 2018 Vincent M\u00fchler')}`);
sections.push(`TensorFlow.js - https://github.com/tensorflow/tfjs\n${await readFile('scripts/licenses/TENSORFLOW-LICENSE', 'utf8')}`);
await writeFile('public/THIRD_PARTY_NOTICES.txt', sections.join('\n\n----------------------------------------\n\n'));
console.log('Generated bundled third-party notices');
