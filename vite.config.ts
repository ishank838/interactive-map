import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const GAME_ID = /^[a-z0-9-]+$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const MAX_BODY = 2_000_000
const MAX_MARKERS = 500
const MAX_TITLE = 120
const MAX_NOTES = 4000

const MARKER_KINDS = new Set([
  'note',
  'base',
  'loot',
  'danger',
  'farm',
  'waypoint',
  'drill',
  'ore',
  'predator',
  'power',
])
const MAX_COMMENTS = 2000
const MAX_COMMENT = 4000

type UserMarker = {
  id: string
  title: string
  notes: string
  color: string
  kind?: string
  longitude: number
  latitude: number
}

type MapUserState = {
  found: string[]
  hiddenCategoryIds: string[]
  hideFound: boolean
  ores: Record<string, string>
  comments?: Record<string, string>
  markers: UserMarker[]
}

const ORE_ID = /^[a-z0-9-]{1,40}$/
const MAX_ORES = 2000

type ProfileRecord = {
  id: string
  name: string
  maps: Record<string, MapUserState>
}

type UserDataFile = {
  version: 2
  revision: number
  activeProfileId: string
  profiles: ProfileRecord[]
}

const PROFILE_ID = /^[A-Za-z0-9-]{1,80}$/
const MAX_PROFILES = 20
const MAX_PROFILE_NAME = 40

function emptyUserData(): UserDataFile {
  return {
    version: 2,
    revision: 0,
    activeProfileId: 'default',
    profiles: [{ id: 'default', name: 'Default', maps: {} }],
  }
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isMarker(value: unknown): value is UserMarker {
  if (!value || typeof value !== 'object') return false
  const marker = value as Partial<UserMarker>
  const kindOk = marker.kind === undefined || (typeof marker.kind === 'string' && MARKER_KINDS.has(marker.kind))
  return (
    typeof marker.id === 'string' &&
    marker.id.length > 0 &&
    marker.id.length <= 80 &&
    typeof marker.title === 'string' &&
    marker.title.length <= MAX_TITLE &&
    typeof marker.notes === 'string' &&
    marker.notes.length <= MAX_NOTES &&
    typeof marker.color === 'string' &&
    COLOR.test(marker.color) &&
    kindOk &&
    typeof marker.longitude === 'number' &&
    Number.isFinite(marker.longitude) &&
    typeof marker.latitude === 'number' &&
    Number.isFinite(marker.latitude)
  )
}

function isStringMap(value: unknown, maxEntries: number, maxValue: number, valuePattern?: RegExp): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  if (entries.length > maxEntries) return false
  return entries.every(
    ([key, item]) =>
      typeof key === 'string' &&
      key.length > 0 &&
      key.length <= 80 &&
      typeof item === 'string' &&
      item.length <= maxValue &&
      (!valuePattern || valuePattern.test(item)),
  )
}

function isOreMap(value: unknown): value is Record<string, string> {
  return isStringMap(value, MAX_ORES, 40, ORE_ID)
}

function isCommentMap(value: unknown): value is Record<string, string> {
  return isStringMap(value, MAX_COMMENTS, MAX_COMMENT)
}

function isMapState(value: unknown): value is MapUserState {
  if (!value || typeof value !== 'object') return false
  const map = value as Partial<MapUserState>
  return (
    isStringList(map.found) &&
    isStringList(map.hiddenCategoryIds) &&
    typeof map.hideFound === 'boolean' &&
    isOreMap(map.ores ?? {}) &&
    isCommentMap(map.comments ?? {}) &&
    Array.isArray(map.markers) &&
    map.markers.length <= MAX_MARKERS &&
    map.markers.every(isMarker)
  )
}

function normalizeMapState(value: MapUserState): MapUserState {
  return {
    ...value,
    ores: value.ores ?? {},
    comments: value.comments ?? {},
    markers: value.markers.map((marker) => ({
      ...marker,
      kind: marker.kind && MARKER_KINDS.has(marker.kind) ? marker.kind : 'note',
    })),
  }
}

function isProfile(value: unknown): value is ProfileRecord {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<ProfileRecord>
  if (typeof profile.id !== 'string' || !PROFILE_ID.test(profile.id)) return false
  if (typeof profile.name !== 'string' || profile.name !== profile.name.trim()) return false
  if (profile.name.length === 0 || profile.name.length > MAX_PROFILE_NAME) return false
  if (!profile.maps || typeof profile.maps !== 'object' || Array.isArray(profile.maps)) return false
  return Object.values(profile.maps).every(isMapState)
}

function isUserData(value: unknown): value is UserDataFile {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<UserDataFile>
  if (data.version !== 2 || typeof data.revision !== 'number' || !Number.isInteger(data.revision) || data.revision < 0) return false
  if (typeof data.activeProfileId !== 'string' || !Array.isArray(data.profiles)) return false
  if (data.profiles.length === 0 || data.profiles.length > MAX_PROFILES) return false
  if (!data.profiles.every(isProfile)) return false
  const ids = new Set(data.profiles.map((profile) => profile.id))
  return ids.size === data.profiles.length && ids.has(data.activeProfileId)
}

function mapHasCustomizations(map: MapUserState) {
  return (
    map.found.length > 0 ||
    map.markers.length > 0 ||
    Object.keys(map.ores ?? {}).length > 0 ||
    Object.keys(map.comments ?? {}).length > 0
  )
}

function normalizeUserData(data: UserDataFile): UserDataFile {
  const profiles: ProfileRecord[] = []
  let imported: ProfileRecord | null = null

  for (const profile of data.profiles) {
    const maps = Object.fromEntries(
      Object.entries(profile.maps).map(([mapId, map]) => [mapId, normalizeMapState(map)]),
    )
    if (profile.id === 'default') {
      if (Object.values(maps).some(mapHasCustomizations)) {
        imported = { id: 'imported', name: 'Imported', maps }
      }
      profiles.push({ id: 'default', name: 'Base', maps: {} })
      continue
    }
    profiles.push({ ...profile, maps })
  }

  if (!profiles.some((profile) => profile.id === 'default')) {
    profiles.unshift({ id: 'default', name: 'Base', maps: {} })
  }
  if (imported && !profiles.some((profile) => profile.id === 'imported')) {
    profiles.push(imported)
  }

  const activeProfileId = profiles.some((profile) => profile.id === data.activeProfileId)
    ? data.activeProfileId
    : 'default'

  return { ...data, activeProfileId, profiles }
}

function migrateUserData(value: unknown): UserDataFile | null {
  if (isUserData(value)) return normalizeUserData(value)
  if (!value || typeof value !== 'object') return null
  const record = value as { version?: unknown; revision?: unknown; maps?: unknown; activeProfileId?: unknown; profiles?: unknown }
  if (record.version === 2 && !('revision' in record)) {
    return migrateUserData({ ...record, revision: 0 })
  }
  if (record.version !== 1 || !record.maps || typeof record.maps !== 'object' || Array.isArray(record.maps)) return null
  if (!Object.values(record.maps).every(isMapState)) return null
  const maps = record.maps as Record<string, MapUserState>
  const hasCustom = Object.values(maps).some((map) => mapHasCustomizations(normalizeMapState(map)))
  return normalizeUserData({
    version: 2,
    revision: 0,
    activeProfileId: hasCustom ? 'imported' : 'default',
    profiles: hasCustom
      ? [
          { id: 'default', name: 'Base', maps: {} },
          { id: 'imported', name: 'Imported', maps },
        ]
      : [{ id: 'default', name: 'Base', maps: {} }],
  })
}

function storedRevision(file: string): number {
  if (!fs.existsSync(file)) return 0
  try {
    const migrated = migrateUserData(JSON.parse(fs.readFileSync(file, 'utf8')))
    return migrated?.revision ?? 0
  } catch {
    return 0
  }
}

function writeUserFile(file: string, data: UserDataFile) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('error', reject)
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

function send(res: ServerResponse, status: number, body: string, json = false) {
  res.statusCode = status
  if (json) res.setHeader('Content-Type', 'application/json')
  res.end(body)
}

function userDataPlugin(): Plugin {
  const dir = path.resolve('data/user')
  return {
    name: 'user-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''
        const match = pathname.match(/^\/api\/user\/([a-z0-9-]+)$/)
        if (!match) {
          next()
          return
        }
        const gameId = match[1]
        if (!gameId || !GAME_ID.test(gameId)) {
          send(res, 400, 'Invalid game id')
          return
        }
        const file = path.resolve(dir, `${gameId}.json`)
        if (!file.startsWith(`${dir}${path.sep}`)) {
          send(res, 400, 'Invalid game id')
          return
        }

        if (req.method === 'GET') {
          if (!fs.existsSync(file)) {
            send(res, 200, JSON.stringify(emptyUserData()), true)
            return
          }
          try {
            const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
            const migrated = migrateUserData(parsed)
            if (!migrated) {
              send(res, 500, 'Saved user data is invalid')
              return
            }
            if (!isUserData(parsed)) writeUserFile(file, migrated)
            send(res, 200, JSON.stringify(migrated), true)
          } catch {
            send(res, 500, 'Saved user data is not valid JSON')
          }
          return
        }

        if (req.method === 'PUT') {
          void readBody(req)
            .then((raw) => {
              let parsed: unknown
              try {
                parsed = JSON.parse(raw)
              } catch {
                send(res, 400, 'Invalid JSON')
                return
              }
              if (!isUserData(parsed)) {
                send(res, 400, 'Invalid user data')
                return
              }
              if (parsed.revision <= storedRevision(file)) {
                send(res, 409, 'Stale profile data')
                return
              }
              writeUserFile(file, normalizeUserData(parsed))
              send(res, 200, JSON.stringify({ ok: true }), true)
            })
            .catch((error: unknown) => {
              const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 400
              send(res, Number.isFinite(status) ? status : 400, error instanceof Error ? error.message : 'Could not save')
            })
          return
        }

        send(res, 405, 'Method not allowed')
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), userDataPlugin()],
  server: { port: 5173 },
})
