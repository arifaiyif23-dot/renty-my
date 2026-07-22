import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const SRC = 'C:/Users/yepwo/Downloads/renty.png'
const PUBLIC = path.resolve('public')

const sizes = [
  { name: 'logo.png', size: null },
  { name: 'favicon.png', size: 48 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

async function main() {
  const img = sharp(SRC)

  for (const { name, size } of sizes) {
    let pipeline = img.clone()
    if (size) pipeline = pipeline.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    await pipeline.toFile(path.join(PUBLIC, name))
    console.log(`✓ ${name}${size ? ` (${size}×${size})` : ' (original)'}`)
  }

  console.log('\nDone!')
}

main().catch(console.error)
