import sharp from 'sharp';

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  throw new Error('Usage: node scripts/process-profile-avatar.mjs <input> <output>');
}

const { data, info } = await sharp(input)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const rgba = Buffer.alloc(info.width * info.height * 4);

for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const source = (y * info.width + x) * 3;
    const target = (y * info.width + x) * 4;
    const r = data[source];
    const g = data[source + 1];
    const b = data[source + 2];
    const outerFrame = x < 3 || y < 3 || x >= info.width - 3 || y >= info.height - 3;
    const nearEdge = x < 14 || y < 14 || x >= info.width - 14 || y >= info.height - 14;
    const whiteCorner = nearEdge && r > 235 && g > 235 && b > 235;
    const purpleBackdrop = b > r - 20 && b > g + 22 && r > g + 10;

    rgba[target] = r;
    rgba[target + 1] = g;
    rgba[target + 2] = b;
    rgba[target + 3] = outerFrame || whiteCorner || purpleBackdrop ? 0 : 255;
  }
}

const visited = new Uint8Array(info.width * info.height);
let largestComponent = [];

for (let start = 0; start < visited.length; start += 1) {
  if (visited[start] || rgba[start * 4 + 3] === 0) continue;
  const component = [];
  const queue = [start];
  visited[start] = 1;

  while (queue.length) {
    const pixel = queue.pop();
    component.push(pixel);
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    const neighbours = [
      x > 0 ? pixel - 1 : -1,
      x < info.width - 1 ? pixel + 1 : -1,
      y > 0 ? pixel - info.width : -1,
      y < info.height - 1 ? pixel + info.width : -1,
    ];

    for (const neighbour of neighbours) {
      if (neighbour >= 0 && !visited[neighbour] && rgba[neighbour * 4 + 3] !== 0) {
        visited[neighbour] = 1;
        queue.push(neighbour);
      }
    }
  }

  if (component.length > largestComponent.length) largestComponent = component;
}

const subjectPixels = new Uint8Array(info.width * info.height);
for (const pixel of largestComponent) subjectPixels[pixel] = 1;
for (let pixel = 0; pixel < subjectPixels.length; pixel += 1) {
  if (!subjectPixels[pixel]) rgba[pixel * 4 + 3] = 0;
}

await sharp(rgba, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
  .resize(112, 112, {
    fit: 'contain',
    kernel: 'nearest',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .resize(512, 512, { fit: 'fill', kernel: 'nearest' })
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);
