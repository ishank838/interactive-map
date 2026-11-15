export type CatalogCategory = {
  id: string
  title: string
  icon: string
  info: string | null
}

export type CatalogGroup = {
  id: string
  title: string
  categories: CatalogCategory[]
}

export type CatalogLocation = {
  id: string
  title: string
  description: string
  categoryId: string
  longitude: number
  latitude: number
}

export type MapGrid = {
  columns: string
  rowCount: number
  west: number
  north: number
  size: number
}

export type MapCatalog = {
  gameId: string
  mapId: string
  title: string
  grid?: MapGrid
  tiles: {
    url: string
    minZoom: number
    maxZoom: number
    initialZoom: number
    center: [number, number]
    bounds: [number, number, number, number]
  }
  groups: CatalogGroup[]
  locations: CatalogLocation[]
}

export type GameCatalog = {
  id: string
  title: string
  maps: MapCatalog[]
}

export const MARKER_KINDS = [
  { id: 'note', title: 'Note', color: '#8b5cf6' },
  { id: 'base', title: 'Outpost', color: '#3d7ec9' },
  { id: 'loot', title: 'Cache', color: '#e0a045' },
  { id: 'danger', title: 'Hazard', color: '#d64545' },
  { id: 'farm', title: 'Crop plot', color: '#3c8f5a' },
  { id: 'waypoint', title: 'Waypoint', color: '#2aa8b8' },
  { id: 'drill', title: 'Deep drill', color: '#c45c26' },
  { id: 'ore', title: 'Ore spot', color: '#b8860b' },
  { id: 'predator', title: 'Predator', color: '#8b3a3a' },
  { id: 'power', title: 'Generator', color: '#d4c04a' },
] as const

export type MarkerKind = (typeof MARKER_KINDS)[number]['id']

export type UserMarker = {
  id: string
  title: string
  notes: string
  color: string
  kind: MarkerKind
  longitude: number
  latitude: number
}

export type MapUserState = {
  found: string[]
  hiddenCategoryIds: string[]
  hideFound: boolean
  /** Deep mining deposit location id → ore id the player rolled. */
  ores: Record<string, string>
  /** Catalog location id → player comment. */
  comments: Record<string, string>
  markers: UserMarker[]
}

export type Profile = {
  id: string
  name: string
  maps: Record<string, MapUserState>
}

export type UserDataFile = {
  version: 2
  revision: number
  activeProfileId: string
  profiles: Profile[]
}

/** Built-in base view: catalog only. Custom notes live on other profiles. */
export const BASE_PROFILE_ID = 'default'
export const BASE_PROFILE_NAME = 'Base'

export function isBaseProfile(profileId: string) {
  return profileId === BASE_PROFILE_ID
}

export function emptyUserData(): UserDataFile {
  return {
    version: 2,
    revision: 0,
    activeProfileId: BASE_PROFILE_ID,
    profiles: [{ id: BASE_PROFILE_ID, name: BASE_PROFILE_NAME, maps: {} }],
  }
}

export function baseProfile(): Profile {
  return { id: BASE_PROFILE_ID, name: BASE_PROFILE_NAME, maps: {} }
}

export type Selection =
  | { kind: 'location'; id: string }
  | { kind: 'marker'; id: string }
  | { kind: 'draft'; longitude: number; latitude: number }

export const MARKER_COLORS = ['#d64545', '#e0a045', '#3c8f5a', '#3d7ec9', '#8b5cf6', '#2aa8b8', '#d7dbe2'] as const

export function isMarkerKind(value: string): value is MarkerKind {
  return MARKER_KINDS.some((kind) => kind.id === value)
}

export function coerceUserMarker(value: Partial<UserMarker> & Pick<UserMarker, 'id' | 'longitude' | 'latitude'>): UserMarker {
  const kind = value.kind && isMarkerKind(value.kind) ? value.kind : 'note'
  const preset = MARKER_KINDS.find((item) => item.id === kind) ?? MARKER_KINDS[0]
  return {
    id: value.id,
    title: value.title ?? '',
    notes: value.notes ?? '',
    color: value.color && /^#[0-9a-fA-F]{6}$/.test(value.color) ? value.color : preset.color,
    kind,
    longitude: value.longitude,
    latitude: value.latitude,
  }
}

export function emptyMapUser(): MapUserState {
  return {
    found: [],
    hiddenCategoryIds: [],
    hideFound: false,
    ores: {},
    comments: {},
    markers: [],
  }
}

export function coerceMapUser(value: Partial<MapUserState> | undefined): MapUserState {
  const base = emptyMapUser()
  if (!value) return base
  return {
    found: value.found ?? base.found,
    hiddenCategoryIds: value.hiddenCategoryIds ?? base.hiddenCategoryIds,
    hideFound: value.hideFound ?? base.hideFound,
    ores: value.ores ?? base.ores,
    comments: value.comments ?? base.comments,
    markers: (value.markers ?? base.markers).map((marker) => coerceUserMarker(marker)),
  }
}
