import sharp from 'sharp';
import { mkdir, unlink } from 'fs/promises';
import { join } from 'path';

const SOURCE = 'C:\\Users\\yepwo\\Downloads\\renty official.png';
const ROOT = 'C:\\Users\\yepwo\\Documents\\renty\\renty-my';
const PUBLIC = join(ROOT, 'public');

// Soft warm cream background: #F5F3EF
const BG_R = 245, BG_G = 243, BG_B = 239;

async function ensureDir(dir) { await mkdir(dir, { recursive: true }); }

// Auto-detect R bounding box from white-bg source
async function extractR() {
  console.log('Extracting R icon from new source...');
  const meta = await sharp(SOURCE).metadata();
  console.log(`  Source: ${meta.width}x${meta.height}`);

  const buf = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = buf;
  const { width, height, channels } = info;

  // Find non-white pixels (the blue R)
  let minX = width, minY = height, maxX = 0, maxY = 0;
  const threshold = 240;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < threshold || g < threshold || b < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`  R bounds: x=${minX}..${maxX} y=${minY}..${maxY}`);

  const PAD = 20;
  const cropW = maxX - minX + PAD * 2;
  const cropH = maxY - minY + PAD * 2;
  const SIZE = Math.max(cropW, cropH);
  const cropX = Math.max(0, minX + (cropW - SIZE) / 2 - PAD);
  const cropY = Math.max(0, minY + (cropH - SIZE) / 2 - PAD);

  const extracted = await sharp(SOURCE)
    .extract({ left: Math.round(cropX), top: Math.round(cropY), width: SIZE, height: SIZE })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const eData = extracted.data;
  const eInfo = extracted.info;

  // Remove white background
  const pixels = Buffer.alloc(eInfo.width * eInfo.height * 4);
  for (let y = 0; y < eInfo.height; y++) {
    for (let x = 0; x < eInfo.width; x++) {
      const si = (y * eInfo.width + x) * eInfo.channels;
      const di = (y * eInfo.width + x) * 4;
      const r = eData[si], g = eData[si + 1], b = eData[si + 2];
      const isWhite = r > 235 && g > 235 && b > 235;
      pixels[di] = r; pixels[di + 1] = g; pixels[di + 2] = b;
      pixels[di + 3] = isWhite ? 0 : 255;
    }
  }

  return sharp(pixels, { raw: { width: eInfo.width, height: eInfo.height, channels: 4 } }).png().toBuffer();
}

async function saveTransparent(buf, filepath, size) {
  await ensureDir(filepath.replace(/[\\/][^\\/]+$/, ''));
  await sharp(buf)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(filepath);
  console.log(`  [transparent] ${filepath} (${size}x${size})`);
}

async function saveWithBg(buf, filepath, size) {
  await ensureDir(filepath.replace(/[\\/][^\\/]+$/, ''));
  await sharp(buf)
    .resize(size, size, { fit: 'contain', background: { r: BG_R, g: BG_G, b: BG_B, alpha: 1 } })
    .png().toFile(filepath);
  console.log(`  [bg #F5F3EF] ${filepath} (${size}x${size})`);
}

async function saveOG(buf, filepath) {
  const size = 1024;
  await ensureDir(filepath.replace(/[\\/][^\\/]+$/, ''));
  const rSize = Math.round(size * 0.45);
  const rBuf = await sharp(buf)
    .resize(rSize, rSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const rMeta = await sharp(rBuf).metadata();
  const offsetX = Math.round((size - rMeta.width) / 2);
  const offsetY = Math.round((size - rMeta.height) / 2);

  const bg = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: BG_R, g: BG_G, b: BG_B, alpha: 255 } }
  }).png().toBuffer();

  await sharp(bg)
    .composite([{ input: rBuf, left: offsetX, top: offsetY }])
    .png().toFile(filepath);
  console.log(`  [og-image] ${filepath} (1024x1024)`);
}

async function saveAdaptive(buf, filepath, size) {
  await ensureDir(filepath.replace(/[\\/][^\\/]+$/, ''));
  const canvasSize = Math.round(size * 108 / 72);
  const iconSize = Math.round(canvasSize * 0.6);
  const rBuf = await sharp(buf)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const rMeta = await sharp(rBuf).metadata();
  const offsetX = Math.round((canvasSize - rMeta.width) / 2);
  const offsetY = Math.round((canvasSize - rMeta.height) / 2);

  const canvas = Buffer.alloc(canvasSize * canvasSize * 4);
  await sharp(canvas, { raw: { width: canvasSize, height: canvasSize, channels: 4 } })
    .composite([{ input: rBuf, left: offsetX, top: offsetY }])
    .resize(size, size, { fit: 'cover' })
    .png().toFile(filepath);
  console.log(`  [adaptive] ${filepath} (${size}x${size})`);
}

async function main() {
  console.log('=== RENTY Icon Generator v3 (New Logo) ===\n');
  const rIcon = await extractR();
  console.log(`  Extracted: ${rIcon.length} bytes\n`);

  // Delete all old logos first
  console.log('Deleting old logos...');
  const oldFiles = ['logo.png', 'logo-light.png', 'favicon.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png', 'logo-dark.png'];
  for (const f of oldFiles) {
    try { await unlink(join(PUBLIC, f)); console.log(`  Deleted ${f}`); } catch {}
  }

  // TRANSPARENT logos — for header, footer, auth
  console.log('\nGenerating transparent logos...');
  await saveTransparent(rIcon, join(PUBLIC, 'favicon.png'), 64);
  await saveTransparent(rIcon, join(PUBLIC, 'logo.png'), 512);
  await saveTransparent(rIcon, join(PUBLIC, 'logo-light.png'), 256);

  // LOGOS WITH BG — for PWA, iOS, splash
  console.log('\nGenerating bg logos (#F5F3EF)...');
  await saveWithBg(rIcon, join(PUBLIC, 'icon-192.png'), 192);
  await saveWithBg(rIcon, join(PUBLIC, 'icon-512.png'), 512);
  await saveWithBg(rIcon, join(PUBLIC, 'apple-touch-icon.png'), 180);

  // OG image
  console.log('\nGenerating OG image...');
  await saveOG(rIcon, join(PUBLIC, 'og-image.png'));

  // Android mipmap icons
  const densities = [
    { name: 'mdpi', size: 48 }, { name: 'hdpi', size: 72 },
    { name: 'xhdpi', size: 96 }, { name: 'xxhdpi', size: 144 }, { name: 'xxxhdpi', size: 192 },
  ];
  console.log('\nGenerating Android icons...');
  for (const { name, size } of densities) {
    const dir = join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${name}`);
    await saveWithBg(rIcon, join(dir, 'ic_launcher.png'), size);
    await saveWithBg(rIcon, join(dir, 'ic_launcher_round.png'), size);
    await saveAdaptive(rIcon, join(dir, 'ic_launcher_foreground.png'), size);
  }

  console.log('\n=== Done! ===');
}

main().catch(console.error);
