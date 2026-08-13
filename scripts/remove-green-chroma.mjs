import sharp from 'sharp';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/remove-green-chroma.mjs <input> <output>');

const { data, info } = await sharp(input)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);

for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
  const source = pixel * 3;
  const target = pixel * 4;
  const r = data[source];
  const g = data[source + 1];
  const b = data[source + 2];
  const greenDominance = g - Math.max(r, b);
  const alpha = greenDominance >= 55 ? 0 : greenDominance <= 12 ? 255 : Math.round(255 * (55 - greenDominance) / 43);

  rgba[target] = r;
  rgba[target + 1] = alpha < 255 ? Math.min(g, Math.max(r, b)) : g;
  rgba[target + 2] = b;
  rgba[target + 3] = alpha;
}

await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
  .resize(512, 512, {
    fit: 'contain',
    kernel: 'nearest',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);
