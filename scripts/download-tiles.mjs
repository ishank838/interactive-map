import fs from 'node:fs'
import path from 'node:path'

const rawPath = path.resolve('data/raw/olympus.mapgenie.json')
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
const tiles = raw.tiles
if (!tiles?.tileBounds || !tiles.remotePattern) {
  throw new Error('Extract is missing tiles.tileBounds or tiles.remotePattern')
}

const minZoom = 8
const maxZoom = 13
const outRoot = path.resolve('public/tiles', raw.gameId, raw.mapId)
const jobs = []

for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
  const band = tiles.tileBounds[String(zoom)]
  if (!band?.x || !band?.y) throw new Error(`Missing tile bounds for zoom ${zoom}`)
  for (let x = band.x.min; x <= band.x.max; x += 1) {
    for (let y = band.y.min; y <= band.y.max; y += 1) {
      jobs.push({ zoom, x, y })
    }
  }
}

async function download(job, attempt = 1) {
  const dest = path.join(outRoot, String(job.zoom), String(job.x), `${job.y}.jpg`)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return 'skip'
  const url = tiles.remotePattern
    .replace('{z}', String(job.zoom))
    .replace('{x}', String(job.x))
    .replace('{y}', String(job.y))
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; icarus-map-import/0.1)' },
    })
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length < 100) throw new Error(`Short tile ${url}`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, body)
    return 'ok'
  } catch (error) {
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
      return download(job, attempt + 1)
    }
    throw error
  }
}

let cursor = 0
let finished = 0
let skipped = 0
const failures = []

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor]
    cursor += 1
    try {
      const result = await download(job)
      if (result === 'skip') skipped += 1
    } catch (error) {
      failures.push(`${job.zoom}/${job.x}/${job.y}: ${error instanceof Error ? error.message : 'failed'}`)
    }
    finished += 1
    if (finished % 100 === 0 || finished === jobs.length) {
      console.log(`${finished}/${jobs.length} (skipped ${skipped}, failed ${failures.length})`)
    }
  }
}

console.log(`Downloading ${jobs.length} tiles into ${outRoot}`)
await Promise.all(Array.from({ length: 12 }, () => worker()))
if (failures.length > 0) {
  console.error(failures.slice(0, 20).join('\n'))
  process.exit(1)
}
console.log(`Tiles ready: ${jobs.length - skipped} downloaded, ${skipped} already present`)
