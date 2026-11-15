import { useEffect, useMemo, useState } from 'react'
import { findGame, games } from './catalog/registry'
import { Home } from './home/Home'
import { Worlds } from './home/Worlds'
import { MapCanvas } from './map/MapCanvas'
import { useRoute } from './route'
import { Sidebar } from './sidebar/Sidebar'
import { useUserData, type UserDataApi } from './state/userData'
import { isDeepOreId } from './catalog/ores'
import { coerceMapUser, isBaseProfile, type GameCatalog, type MapCatalog, type Selection, type UserMarker } from './types'

export function App() {
  const { path, navigate } = useRoute()
  const parts = path.split('/').filter(Boolean)

  if (parts.length === 0) return <Home games={games} onOpen={(gameId) => navigate(`/${gameId}`)} />

  const game = findGame(parts[0] ?? '')
  if (!game || parts.length > 2) {
    return <MissingPage title="That page is not here" href="/" label="Back to games" onBack={() => navigate('/')} />
  }

  return <GameShell game={game} mapId={parts[1]} navigate={navigate} />
}

function GameShell(props: { game: GameCatalog; mapId?: string; navigate: (path: string) => void }) {
  const user = useUserData(props.game.id)
  const mapCatalog = props.mapId ? props.game.maps.find((map) => map.mapId === props.mapId) : undefined

  if (props.mapId && !mapCatalog) {
    return (
      <MissingPage
        title="That world is not here"
        href={`/${props.game.id}`}
        label="Back to worlds"
        onBack={() => props.navigate(`/${props.game.id}`)}
      />
    )
  }

  if (!mapCatalog) {
    return (
      <Worlds
        game={props.game}
        user={user}
        onHome={() => props.navigate('/')}
        onOpen={(mapId) => props.navigate(`/${props.game.id}/${mapId}`)}
      />
    )
  }

  return (
    <GameMap
      game={props.game}
      mapCatalog={mapCatalog}
      user={user}
      onHome={() => props.navigate('/')}
      onWorlds={() => props.navigate(`/${props.game.id}`)}
      onMapId={(mapId) => props.navigate(`/${props.game.id}/${mapId}`)}
    />
  )
}

function MissingPage(props: { title: string; href: string; label: string; onBack: () => void }) {
  return (
    <main className="home">
      <h1>{props.title}</h1>
      <p className="home-lead">
        <a
          className="text-link"
          href={props.href}
          onClick={(event) => {
            event.preventDefault()
            props.onBack()
          }}
        >
          {props.label}
        </a>
      </p>
    </main>
  )
}

function GameMap(props: {
  game: GameCatalog
  mapCatalog: MapCatalog
  user: UserDataApi
  onHome: () => void
  onWorlds: () => void
  onMapId: (mapId: string) => void
}) {
  const game = props.game
  const mapCatalog = props.mapCatalog
  const { data, status, error, storageMode, onBase, sessionMaps, updateMap, selectProfile, createProfile, deleteProfile } =
    props.user
  const activeProfile = data?.profiles.find((profile) => profile.id === data.activeProfileId)
  const mapUser = onBase
    ? coerceMapUser(sessionMaps[mapCatalog.mapId])
    : coerceMapUser(activeProfile?.maps[mapCatalog.mapId])
  const [search, setSearch] = useState('')
  const [oreFilter, setOreFilter] = useState<string[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [placing, setPlacing] = useState(false)

  const categoryById = useMemo(() => {
    const categories = new Map<string, { title: string; icon: string }>()
    for (const group of mapCatalog.groups) {
      for (const category of group.categories) categories.set(category.id, category)
    }
    return categories
  }, [mapCatalog])

  const categoryIcon = useMemo(() => {
    const icons = new Map<string, string>()
    for (const [id, category] of categoryById) icons.set(id, category.icon)
    return icons
  }, [categoryById])

  const foundIds = useMemo(() => new Set(mapUser.found), [mapUser.found])
  const hiddenIds = useMemo(() => new Set(mapUser.hiddenCategoryIds), [mapUser.hiddenCategoryIds])

  const visibleLocations = useMemo(() => {
    const query = search.trim().toLowerCase()
    const oreSet = new Set(oreFilter)
    return mapCatalog.locations.filter((location) => {
      if (hiddenIds.has(location.categoryId)) return false
      if (mapUser.hideFound && foundIds.has(location.id)) return false
      if (oreSet.size > 0) {
        const ore = mapUser.ores[location.id]
        if (!ore || !oreSet.has(ore)) return false
      }
      if (!query) return true
      const categoryTitle = categoryById.get(location.categoryId)?.title ?? ''
      const oreTitle = mapUser.ores[location.id] ?? ''
      const comment = mapUser.comments[location.id] ?? ''
      return `${location.title} ${categoryTitle} ${oreTitle} ${comment}`.toLowerCase().includes(query)
    })
  }, [mapCatalog.locations, hiddenIds, mapUser.hideFound, mapUser.ores, mapUser.comments, foundIds, search, oreFilter, categoryById])

  useEffect(() => {
    document.title = `${mapCatalog.title} · ${game.title}`
  }, [game.title, mapCatalog.title])

  useEffect(() => {
    setSearch('')
    setOreFilter([])
    setSelection(null)
    setPlacing(false)
  }, [mapCatalog.mapId, data?.activeProfileId])

  const disabled = !data
  const editsLocked = disabled || onBase
  const savedLabel = storageMode === 'local' ? 'Saved in this browser' : 'Saved'
  const statusLabel = onBase
    ? 'Base view — create a profile to save markers and details'
    : status === 'saving'
      ? 'Saving…'
      : status === 'saved'
        ? savedLabel
        : status === 'loading'
          ? 'Loading your notes…'
          : storageMode === 'local'
            ? 'Profiles save in this browser on Cloudflare'
            : ''
  const focusKey =
    selection?.kind === 'location' ? `location:${selection.id}` : selection?.kind === 'marker' ? `marker:${selection.id}` : ''

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      if (event.key === 'Escape') {
        setPlacing(false)
        setSelection((current) => (current?.kind === 'draft' ? null : current))
        return
      }
      if (typing || editsLocked) return
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault()
        setPlacing((current) => !current)
        setSelection((current) => (current?.kind === 'draft' ? null : current))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editsLocked])

  function toggleFound(locationId: string) {
    if (editsLocked) return
    updateMap(mapCatalog.mapId, (current) => {
      const found = new Set(current.found)
      if (found.has(locationId)) found.delete(locationId)
      else found.add(locationId)
      return { ...current, found: [...found] }
    }, 'custom')
  }

  function setLocationOre(locationId: string, oreId: string) {
    if (editsLocked) return
    updateMap(mapCatalog.mapId, (current) => {
      const ores = { ...current.ores }
      if (!oreId) delete ores[locationId]
      else {
        if (!isDeepOreId(oreId)) return current
        ores[locationId] = oreId
      }
      return { ...current, ores }
    }, 'custom')
  }

  function setLocationComment(locationId: string, comment: string) {
    if (editsLocked) return
    updateMap(mapCatalog.mapId, (current) => {
      const comments = { ...current.comments }
      const trimmed = comment.trim()
      if (!trimmed) delete comments[locationId]
      else comments[locationId] = trimmed.slice(0, 4000)
      return { ...current, comments }
    }, 'custom')
  }

  function toggleOreFilter(oreId: string) {
    setOreFilter((current) => (current.includes(oreId) ? current.filter((id) => id !== oreId) : [...current, oreId]))
  }

  function saveMarker(marker: UserMarker) {
    if (editsLocked) return
    updateMap(mapCatalog.mapId, (current) => {
      const exists = current.markers.some((item) => item.id === marker.id)
      return {
        ...current,
        markers: exists ? current.markers.map((item) => (item.id === marker.id ? marker : item)) : [...current.markers, marker],
      }
    }, 'custom')
    setSelection({ kind: 'marker', id: marker.id })
    setPlacing(false)
  }

  return (
    <div className="app">
      <Sidebar
        gameTitle={game.title}
        worldTitle={mapCatalog.title}
        onHome={props.onHome}
        onWorlds={props.onWorlds}
        worldsHref={`/${game.id}`}
        maps={game.maps.map((map) => ({ mapId: map.mapId, title: map.title }))}
        mapId={mapCatalog.mapId}
        onMapId={props.onMapId}
        profiles={data?.profiles ?? []}
        activeProfileId={data?.activeProfileId ?? ''}
        onSelectProfile={(profileId) => {
          selectProfile(profileId)
          setSelection(null)
          setPlacing(false)
        }}
        onCreateProfile={createProfile}
        onDeleteProfile={(profileId) => {
          if (isBaseProfile(profileId)) return
          deleteProfile(profileId)
          setSelection(null)
          setPlacing(false)
        }}
        catalog={mapCatalog}
        user={mapUser}
        search={search}
        onSearch={setSearch}
        oreFilter={oreFilter}
        onToggleOreFilter={toggleOreFilter}
        onClearOreFilter={() => setOreFilter([])}
        visibleLocations={visibleLocations}
        selection={selection}
        statusLabel={statusLabel}
        error={error}
        disabled={disabled}
        editsLocked={editsLocked}
        onBase={onBase}
        onShowAll={() => updateMap(mapCatalog.mapId, (current) => ({ ...current, hiddenCategoryIds: [] }), 'filter')}
        onHideAll={() =>
          updateMap(
            mapCatalog.mapId,
            (current) => ({
              ...current,
              hiddenCategoryIds: mapCatalog.groups.flatMap((group) => group.categories.map((category) => category.id)),
            }),
            'filter',
          )
        }
        onToggleHideFound={() =>
          updateMap(mapCatalog.mapId, (current) => ({ ...current, hideFound: !current.hideFound }), 'filter')
        }
        onToggleCategory={(categoryId) =>
          updateMap(
            mapCatalog.mapId,
            (current) => {
              const hidden = new Set(current.hiddenCategoryIds)
              if (hidden.has(categoryId)) hidden.delete(categoryId)
              else hidden.add(categoryId)
              return { ...current, hiddenCategoryIds: [...hidden] }
            },
            'filter',
          )
        }
        onToggleFound={toggleFound}
        onSelectLocation={(locationId) => {
          setPlacing(false)
          setSelection({ kind: 'location', id: locationId })
        }}
        onSelectMarker={(markerId) => {
          setPlacing(false)
          setSelection({ kind: 'marker', id: markerId })
        }}
      />
      <div className="map-wrap">
        <MapCanvas
          mapCatalog={mapCatalog}
          locations={visibleLocations}
          categoryIcon={categoryIcon}
          foundIds={foundIds}
          markers={mapUser.markers}
          user={mapUser}
          selection={selection}
          placing={placing}
          focusKey={focusKey}
          editsLocked={editsLocked}
          onSelectLocation={(locationId) => {
            setPlacing(false)
            setSelection({ kind: 'location', id: locationId })
          }}
          onSelectMarker={(markerId) => {
            setPlacing(false)
            setSelection({ kind: 'marker', id: markerId })
          }}
          onPlace={(longitude, latitude) => {
            if (editsLocked) return
            setPlacing(false)
            setSelection({ kind: 'draft', longitude, latitude })
          }}
          onToggleFound={toggleFound}
          onSetLocationOre={setLocationOre}
          onSetLocationComment={setLocationComment}
          onSaveMarker={saveMarker}
          onDeleteMarker={(markerId) => {
            if (editsLocked) return
            updateMap(
              mapCatalog.mapId,
              (current) => ({
                ...current,
                markers: current.markers.filter((marker) => marker.id !== markerId),
              }),
              'custom',
            )
            setSelection(null)
          }}
          onCancel={() => setSelection(null)}
        />
        <button
          type="button"
          className={placing ? 'place-button active' : 'place-button'}
          disabled={editsLocked}
          title={onBase ? 'Create a profile to place markers' : 'Shortcut: M'}
          onClick={() => {
            if (editsLocked) return
            setPlacing((current) => !current)
            setSelection((current) => (current?.kind === 'draft' ? null : current))
          }}
        >
          {placing ? 'Cancel place (Esc)' : 'Place marker (M)'}
        </button>
        {placing ? <p className="place-hint">Cursor is a pin — click the map to drop, then pick type and comment.</p> : null}
      </div>
    </div>
  )
}
