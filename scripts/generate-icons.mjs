import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
for (const size of [16, 32, 48, 128]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(new URL(`../public/icon-${size}.png`, import.meta.url).pathname);
}
console.log('Generated bundled TableLyft icons.');
