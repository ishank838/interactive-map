import { useMemo, useState } from 'react'
import { DEEP_ORES, oreTitle } from '../catalog/ores'
import { ProfileControl } from '../profiles/ProfileControl'
import type { CatalogLocation, MapCatalog, MapUserState, Profile, Selection } from '../types'

type SidebarProps = {
  gameTitle: string
  worldTitle: string
  onHome: () => void
  onWorlds: () => void
  worldsHref: string
  profiles: Profile[]
  activeProfileId: string
  onSelectProfile: (profileId: string) => void
  onCreateProfile: (name: string) => void
  onDeleteProfile: (profileId: string) => void
  maps: { mapId: string; title: string }[]
  mapId: string
  onMapId: (mapId: string) => void
  catalog: MapCatalog
  user: MapUserState
  search: string
  onSearch: (value: string) => void
  oreFilter: string[]
  onToggleOreFilter: (oreId: string) => void
  onClearOreFilter: () => void
  visibleLocations: CatalogLocation[]
  selection: Selection | null
  statusLabel: string
  error: string | null
  disabled: boolean
  onBase: boolean
  onShowAll: () => void
  onHideAll: () => void
  onToggleHideFound: () => void
  onToggleCategory: (categoryId: string) => void
  onToggleFound: (locationId: string) => void
  onSelectLocation: (locationId: string) => void
  onSelectMarker: (markerId: string) => void
  editsLocked: boolean
}

export function Sidebar(props: SidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const filtering = props.search.trim().length > 0 || props.oreFilter.length > 0

  const categoryById = useMemo(() => {
    const categories = new Map<string, { title: string; icon: string; info: string | null }>()
    for (const group of props.catalog.groups) {
      for (const category of group.categories) categories.set(category.id, category)
    }
    return categories
  }, [props.catalog])

  function isOpen(sectionId: string) {
    return openSections[sectionId] === true
  }

  function toggleSection(sectionId: string) {
    setOpenSections((current) => ({ ...current, [sectionId]: !current[sectionId] }))
  }

  const counts = useMemo(() => {
    const total = new Map<string, number>()
    const found = new Map<string, number>()
    const foundSet = new Set(props.user.found)
    for (const location of props.catalog.locations) {
      total.set(location.categoryId, (total.get(location.categoryId) ?? 0) + 1)
      if (foundSet.has(location.id)) found.set(location.categoryId, (found.get(location.categoryId) ?? 0) + 1)
    }
    return { total, found }
  }, [props.catalog.locations, props.user.found])

  const hidden = new Set(props.user.hiddenCategoryIds)
  const foundSet = new Set(props.user.found)

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="game-heading">
          <p className="crumbs">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault()
                props.onHome()
              }}
            >
              Games
            </a>
            <span aria-hidden="true">/</span>
            <a
              href={props.worldsHref}
              onClick={(event) => {
                event.preventDefault()
                props.onWorlds()
              }}
            >
              {props.gameTitle}
            </a>
          </p>
          <p className="game-title">{props.worldTitle}</p>
        </div>
        <label className="map-picker">
          <span>World</span>
          <select value={props.mapId} onChange={(event) => props.onMapId(event.target.value)}>
            {props.maps.map((map) => (
              <option key={map.mapId} value={map.mapId}>
                {map.title}
              </option>
            ))}
          </select>
        </label>
      </header>

      <ProfileControl
        profiles={props.profiles}
        activeProfileId={props.activeProfileId}
        disabled={props.disabled}
        onSelect={props.onSelectProfile}
        onCreate={props.onCreateProfile}
        onDelete={props.onDeleteProfile}
      />
      {props.onBase ? (
        <p className="profile-hint">
          Base is the catalog view. Filters stay in this session. Create a profile to save markers, found checks, and ores.
        </p>
      ) : null}

      <label className="search">
        <span className="sr-only">Search locations</span>
        <input
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
          placeholder="Search locations"
          type="search"
        />
      </label>

      <div className="toolbar">
        <button type="button" onClick={props.onShowAll} disabled={props.disabled}>
          Show all
        </button>
        <button type="button" onClick={props.onHideAll} disabled={props.disabled}>
          Hide all
        </button>
        <label className="check-row">
          <input type="checkbox" checked={props.user.hideFound} onChange={props.onToggleHideFound} disabled={props.disabled} />
          Hide found
        </label>
      </div>

      <section className="fold advanced-search">
        <button
          type="button"
          className="fold-toggle"
          aria-expanded={isOpen('advanced')}
          onClick={() => toggleSection('advanced')}
        >
          <span className="fold-chevron" aria-hidden="true">
            {isOpen('advanced') ? '▾' : '▸'}
          </span>
          <span>Advanced search</span>
          {props.oreFilter.length > 0 ? <span className="count">{props.oreFilter.length} ores</span> : null}
        </button>
        {isOpen('advanced') ? (
          <div className="advanced-body">
            <p className="advanced-hint">Show only deep mining deposits you tagged with these ores.</p>
            <div className="ore-filter-grid">
              {DEEP_ORES.map((ore) => (
                <label key={ore.id} className="ore-filter-row">
                  <input
                    type="checkbox"
                    checked={props.oreFilter.includes(ore.id)}
                    onChange={() => props.onToggleOreFilter(ore.id)}
                    disabled={props.disabled}
                  />
                  <span>{ore.title}</span>
                </label>
              ))}
            </div>
            {props.oreFilter.length > 0 ? (
              <button type="button" className="clear-filter" onClick={props.onClearOreFilter}>
                Clear ore filter
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="categories">
        {props.catalog.groups.map((group) => {
          const open = isOpen(group.id)
          const visibleCount = group.categories.filter((category) => !hidden.has(category.id)).length
          return (
            <section key={group.id} className="fold">
              <button type="button" className="fold-toggle" aria-expanded={open} onClick={() => toggleSection(group.id)}>
                <span className="fold-chevron" aria-hidden="true">
                  {open ? '▾' : '▸'}
                </span>
                <span>{group.title}</span>
                <span className="count">
                  {visibleCount}/{group.categories.length}
                </span>
              </button>
              {open ? (
                <ul>
                  {group.categories.map((category) => {
                    const visible = !hidden.has(category.id)
                    return (
                      <li key={category.id}>
                        <label className="category-row" title={category.info ?? undefined}>
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => props.onToggleCategory(category.id)}
                            disabled={props.disabled}
                          />
                          <img src={`/icons/icarus/glyphs/${category.icon}.png`} alt="" />
                          <span>{category.title}</span>
                          <span className="count">
                            {counts.found.get(category.id) ?? 0}/{counts.total.get(category.id) ?? 0}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </section>
          )
        })}

        <section className="fold">
          <button
            type="button"
            className="fold-toggle"
            aria-expanded={isOpen('markers')}
            onClick={() => toggleSection('markers')}
          >
            <span className="fold-chevron" aria-hidden="true">
              {isOpen('markers') ? '▾' : '▸'}
            </span>
            <span>My markers</span>
            <span className="count">{props.user.markers.length}</span>
          </button>
          {isOpen('markers') ? (
            <>
              {props.user.markers.length === 0 ? <p className="empty">No markers yet.</p> : null}
              <ul className="marker-list">
                {props.user.markers.map((marker) => (
                  <li key={marker.id}>
                    <button
                      type="button"
                      className={props.selection?.kind === 'marker' && props.selection.id === marker.id ? 'selected' : ''}
                      onClick={() => props.onSelectMarker(marker.id)}
                    >
                      <span className="swatch" style={{ background: marker.color }} />
                      {marker.title || 'Untitled marker'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>

      {filtering ? (
        <div className="location-list compact">
          <p className="results-label">{props.visibleLocations.length} matches — click to open on the map</p>
          {props.visibleLocations.length === 0 ? <p className="empty">No locations match.</p> : null}
          <ul>
            {props.visibleLocations.slice(0, 12).map((location) => {
              const category = categoryById.get(location.categoryId)
              const selected = props.selection?.kind === 'location' && props.selection.id === location.id
              return (
                <li key={location.id}>
                  <label className="found-check">
                    <input
                      type="checkbox"
                      checked={foundSet.has(location.id)}
                      onChange={() => props.onToggleFound(location.id)}
                      disabled={props.editsLocked}
                      aria-label={`Mark ${location.title} found`}
                    />
                  </label>
                  <button type="button" className={selected ? 'selected' : ''} onClick={() => props.onSelectLocation(location.id)}>
                    {category ? <img src={`/icons/icarus/glyphs/${category.icon}.png`} alt="" /> : null}
                    <span>
                      {location.title}
                      {oreTitle(props.user.ores[location.id]) ? ` · ${oreTitle(props.user.ores[location.id])}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {props.visibleLocations.length > 12 ? <p className="empty">Showing first 12 — open pins on the map for details.</p> : null}
        </div>
      ) : null}

      <p className={props.error ? 'status error' : 'status'}>{props.error ?? props.statusLabel}</p>
    </aside>
  )
}
