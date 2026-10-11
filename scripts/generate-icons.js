import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgBuffer = fs.readFileSync(path.resolve('public/icon.svg'));
const sizes = [16, 32, 48, 128];

async function generate() {
  for (const size of sizes) {
    const outPath = path.resolve(`public/icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
}

generate().catch(console.error);
