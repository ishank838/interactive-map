import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')

const root = path.resolve('public/icons/icarus')
const manifestPath = path.join(root, 'manifest.json')
const atlasPath = path.join(root, 'atlas.png')

if (!fs.existsSync(manifestPath) || !fs.existsSync(atlasPath)) {
  throw new Error('Missing public/icons/icarus/manifest.json or atlas.png')
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const atlas = PNG.sync.read(fs.readFileSync(atlasPath))

function crop(rect, label) {
  if (!rect || typeof rect.x !== 'number' || typeof rect.w !== 'number') {
    throw new Error(`Missing atlas rect for ${label}`)
  }
  const image = new PNG({ width: rect.w, height: rect.h })
  PNG.bitblt(atlas, image, rect.x, rect.y, rect.w, rect.h, 0, 0)
  return PNG.sync.write(image)
}

const markerDir = path.join(root, 'markers')
const glyphDir = path.join(root, 'glyphs')
fs.mkdirSync(markerDir, { recursive: true })
fs.mkdirSync(glyphDir, { recursive: true })

const icons = new Set()
for (const category of Object.values(manifest.categories ?? {})) {
  if (category && category.icon) icons.add(category.icon)
}

let written = 0
for (const icon of icons) {
  const sample = Object.values(manifest.categories).find((category) => category.icon === icon)
  const marker = manifest.markers?.[sample?.marker]
  const glyph = manifest.glyphs?.[manifest.icons?.[icon]]
  if (!marker) throw new Error(`No marker image for ${icon}`)
  fs.writeFileSync(path.join(markerDir, `${icon}.png`), crop(marker, icon))
  if (glyph) fs.writeFileSync(path.join(glyphDir, `${icon}.png`), crop(glyph, `${icon} glyph`))
  written += 1
}

console.log(`Sliced ${written} icons into ${root}`)
