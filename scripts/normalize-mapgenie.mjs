import fs from 'node:fs'
import path from 'node:path'

const input = process.argv[2] ?? 'data/raw/olympus.mapgenie.json'
const output = process.argv[3] ?? 'src/catalog/games/icarus/olympus.json'

const raw = JSON.parse(fs.readFileSync(input, 'utf8'))

function required(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing ${label}`)
  }
  return value
}

const tiles = required(raw.tiles, 'tiles')
const bounds = tiles.bounds
const center = tiles.center
if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some((value) => typeof value !== 'number')) {
  throw new Error('tiles.bounds must be [west, south, east, north]')
}
if (!Array.isArray(center) || center.length !== 2 || center.some((value) => typeof value !== 'number')) {
  throw new Error('tiles.center must be [lng, lat]')
}

const groups = (raw.groups ?? []).map((group) => ({
  id: String(required(group.id, 'group.id')),
  title: String(required(group.title, 'group.title')),
  categories: (group.categories ?? []).map((category) => ({
    id: String(required(category.id, 'category.id')),
    title: String(required(category.title, 'category.title')),
    icon: String(required(category.icon, `category.icon for ${category.title}`)),
    info: category.info ?? null,
  })),
}))

const categoryIds = new Set(groups.flatMap((group) => group.categories.map((category) => category.id)))
const seen = new Set()
const locations = (raw.locations ?? []).map((location) => {
  const id = String(required(location.id, 'location.id'))
  if (seen.has(id)) throw new Error(`Duplicate location id ${id}`)
  seen.add(id)
  const categoryId = String(required(location.categoryId, `categoryId for ${id}`))
  if (!categoryIds.has(categoryId)) throw new Error(`Unknown category ${categoryId} on location ${id}`)
  const longitude = location.longitude
  const latitude = location.latitude
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    throw new Error(`Bad coordinates on location ${id}`)
  }
  return {
    id,
    categoryId,
    title: String(location.title ?? ''),
    description: String(location.description ?? ''),
    longitude,
    latitude,
  }
})

const catalog = {
  gameId: String(required(raw.gameId, 'gameId')),
  mapId: String(required(raw.mapId, 'mapId')),
  title: String(required(raw.mapTitle, 'mapTitle')),
  tiles: {
    url: String(required(tiles.localPattern, 'tiles.localPattern')),
    minZoom: tiles.minZoom,
    maxZoom: tiles.maxZoom,
    initialZoom: tiles.initialZoom,
    center,
    bounds,
  },
  groups,
  locations,
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Wrote ${locations.length} locations to ${output}`)
