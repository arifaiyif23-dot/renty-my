import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sizes = [
  { name: 'icon-192', size: 192, fontSize: 82 },
  { name: 'icon-512', size: 512, fontSize: 220 },
  { name: 'apple-touch-icon', size: 180, fontSize: 76 },
];

const fontPath = path.resolve(__dirname, '../public/fonts/Chunk.otf');
const fontUrl = `file:///${fontPath.replace(/\\/g, '/')}`;

async function generate() {
  const browser = await chromium.launch();

  for (const { name, size, fontSize } of sizes) {
    const context = await browser.newContext({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  @font-face {
    font-family: 'Chunk';
    src: url('${fontUrl}') format('opentype');
  }
  body {
    margin: 0;
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #E8EDDF;
  }
  span {
    font-family: 'Chunk', serif;
    font-size: ${fontSize}px;
    color: #1F2E4A;
    line-height: 1;
    text-align: center;
  }
</style>
</head>
<body>
  <span>renty</span>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.resolve(__dirname, `../public/${name}.png`),
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`Generated ${name}.png (${size}x${size})`);

    await context.close();
  }

  await browser.close();
  console.log('Done!');
}

generate().catch(console.error);
