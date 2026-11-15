import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapMouseEvent, type Popup } from 'maplibre-gl'
import { LocationPopup, MarkerPopup } from './PinPopup'
import { gridLabelCollection, gridLabelImage, gridLineCollection } from './grid'
import type { CatalogLocation, MapCatalog, MapUserState, Selection, UserMarker } from '../types'

type MapCanvasProps = {
  mapCatalog: MapCatalog
  locations: CatalogLocation[]
  categoryIcon: Map<string, string>
  foundIds: Set<string>
  markers: UserMarker[]
  user: MapUserState
  selection: Selection | null
  placing: boolean
  focusKey: string
  editsLocked: boolean
  onSelectLocation: (id: string) => void
  onSelectMarker: (id: string) => void
  onPlace: (longitude: number, latitude: number) => void
  onToggleFound: (locationId: string) => void
  onSetLocationOre: (locationId: string, oreId: string) => void
  onSetLocationComment: (locationId: string, comment: string) => void
  onSaveMarker: (marker: UserMarker) => void
  onDeleteMarker: (markerId: string) => void
  onCancel: () => void
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function checkImage(): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw the found check')
  context.fillStyle = '#1f8a42'
  context.beginPath()
  context.arc(16, 16, 14, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#ffffff'
  context.lineWidth = 3
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(8, 17)
  context.lineTo(14, 23)
  context.lineTo(24, 10)
  context.stroke()
  return context.getImageData(0, 0, 32, 32)
}

function pinImage(color: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw a marker')
  context.fillStyle = color
  context.strokeStyle = '#14181f'
  context.lineWidth = 3
  context.beginPath()
  context.arc(24, 20, 14, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.beginPath()
  context.moveTo(14, 28)
  context.lineTo(24, 58)
  context.lineTo(34, 28)
  context.closePath()
  context.fill()
  context.stroke()
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.arc(24, 20, 5, 0, Math.PI * 2)
  context.fill()
  return context.getImageData(0, 0, 48, 64)
}

function pinImageId(color: string) {
  return `pin-${color.toLowerCase()}`
}

/** Nudge the map when a tall popup still can't fit near a screen edge. */
function keepPopupInView(map: MapLibreMap, longitude: number, latitude: number) {
  const point = map.project([longitude, latitude])
  const width = map.getContainer().clientWidth
  const height = map.getContainer().clientHeight
  const marginX = 160
  const marginY = 200
  let dx = 0
  let dy = 0
  if (point.x < marginX) dx = marginX - point.x
  else if (point.x > width - marginX) dx = width - marginX - point.x
  if (point.y < marginY) dy = marginY - point.y
  else if (point.y > height - marginY) dy = height - marginY - point.y
  if (dx === 0 && dy === 0) return
  map.panBy([dx, dy], { duration: 280 })
}

export function MapCanvas({
  mapCatalog,
  locations,
  categoryIcon,
  foundIds,
  markers,
  user,
  selection,
  placing,
  focusKey,
  editsLocked,
  onSelectLocation,
  onSelectMarker,
  onPlace,
  onToggleFound,
  onSetLocationOre,
  onSetLocationComment,
  onSaveMarker,
  onDeleteMarker,
  onCancel,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const popupRef = useRef<Popup | null>(null)
  const popupRootRef = useRef<Root | null>(null)
  const popupHostRef = useRef<HTMLDivElement | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const fittedSelectionRef = useRef<string | null>(null)
  const handlers = useRef({ onSelectLocation, onSelectMarker, onPlace, placing, onCancel })
  handlers.current = { onSelectLocation, onSelectMarker, onPlace, placing, onCancel }
  const snapshot = useRef({ locations, categoryIcon, foundIds, markers, selection })
  snapshot.current = { locations, categoryIcon, foundIds, markers, selection }
  const popupSnapshot = useRef({
    mapCatalog,
    user,
    selection,
    markers,
    editsLocked,
    onToggleFound,
    onSetLocationOre,
    onSetLocationComment,
    onSelectLocation,
    onSaveMarker,
    onDeleteMarker,
    onCancel,
  })
  popupSnapshot.current = {
    mapCatalog,
    user,
    selection,
    markers,
    editsLocked,
    onToggleFound,
    onSetLocationOre,
    onSetLocationComment,
    onSelectLocation,
    onSaveMarker,
    onDeleteMarker,
    onCancel,
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const [west, south, east, north] = mapCatalog.tiles.bounds
    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          terrain: {
            type: 'raster',
            tiles: [mapCatalog.tiles.url],
            tileSize: 256,
            minzoom: mapCatalog.tiles.minZoom,
            maxzoom: mapCatalog.tiles.maxZoom,
          },
        },
        layers: [{ id: 'terrain', type: 'raster', source: 'terrain' }],
      },
      center: mapCatalog.tiles.center,
      zoom: mapCatalog.tiles.initialZoom,
      minZoom: mapCatalog.tiles.minZoom,
      maxZoom: mapCatalog.tiles.maxZoom,
      maxBounds: [
        [west, south],
        [east, north],
      ],
      renderWorldCopies: false,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map
    readyRef.current = false

    const host = document.createElement('div')
    popupHostRef.current = host
    popupRootRef.current = createRoot(host)
    // No fixed `anchor` — MapLibre picks the best side so the popup stays on-screen.
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      maxWidth: '320px',
      className: 'map-pin-popup',
      offset: {
        top: [0, 14],
        'top-left': [14, 14],
        'top-right': [-14, 14],
        bottom: [0, -30],
        'bottom-left': [14, -30],
        'bottom-right': [-14, -30],
        left: [16, -12],
        right: [-16, -12],
        center: [0, -16],
      },
      padding: { top: 56, bottom: 52, left: 16, right: 56 },
    })
    popup.on('close', () => handlers.current.onCancel())
    popupRef.current = popup

    const onClick = (event: MapMouseEvent) => {
      const current = handlers.current
      if (current.placing) {
        current.onPlace(event.lngLat.lng, event.lngLat.lat)
        return
      }
      if (!map.getLayer('user-markers') || !map.getLayer('locations')) return
      const markerHit = map.queryRenderedFeatures(event.point, { layers: ['user-markers'] })[0]
      const markerId = markerHit?.properties?.id
      if (typeof markerId === 'string') {
        current.onSelectMarker(markerId)
        return
      }
      const locationHit = map.queryRenderedFeatures(event.point, { layers: ['locations'] })[0]
      const locationId = locationHit?.properties?.id
      if (typeof locationId === 'string') current.onSelectLocation(locationId)
      else current.onCancel()
    }
    map.on('click', onClick)
    const onMove = (event: MapMouseEvent) => {
      if (handlers.current.placing) {
        map.getCanvas().style.cursor = 'none'
        setGhost({ x: event.point.x, y: event.point.y })
        return
      }
      setGhost(null)
      if (!map.getLayer('locations')) {
        map.getCanvas().style.cursor = ''
        return
      }
      const hovered = map.queryRenderedFeatures(event.point, { layers: ['locations', 'user-markers'] })
      map.getCanvas().style.cursor = hovered.length > 0 ? 'pointer' : ''
    }
    const onLeave = () => setGhost(null)
    map.on('mousemove', onMove)
    map.getCanvas().addEventListener('mouseleave', onLeave)

    map.on('load', () => {
      void (async () => {
        const icons = [...new Set(mapCatalog.groups.flatMap((group) => group.categories.map((category) => category.icon)))]
        await Promise.all(
          icons.map(async (icon) => {
            const image = await map.loadImage(`/icons/icarus/markers/${icon}.png`)
            if (!map.hasImage(icon)) map.addImage(icon, image.data, { pixelRatio: 2 })
          }),
        )
        if (!map.hasImage('found-check')) map.addImage('found-check', checkImage(), { pixelRatio: 2 })
        const grid = mapCatalog.grid
        if (grid) {
          const labels = gridLabelCollection(grid)
          for (const feature of labels.features) {
            const label = feature.properties?.label
            if (typeof label !== 'string' || map.hasImage(`grid-${label}`)) continue
            map.addImage(`grid-${label}`, gridLabelImage(label), { pixelRatio: 2 })
          }
          map.addSource('grid-lines', { type: 'geojson', data: gridLineCollection(grid) })
          map.addSource('grid-labels', { type: 'geojson', data: labels })
          map.addLayer({
            id: 'grid-lines-edge',
            type: 'line',
            source: 'grid-lines',
            paint: { 'line-color': '#10141a', 'line-width': 3, 'line-opacity': 0.45 },
          })
          map.addLayer({
            id: 'grid-lines',
            type: 'line',
            source: 'grid-lines',
            paint: { 'line-color': '#f7f4ea', 'line-width': 1, 'line-opacity': 0.8 },
          })
          map.addLayer({
            id: 'grid-labels',
            type: 'symbol',
            source: 'grid-labels',
            minzoom: 10,
            layout: {
              'icon-image': ['concat', 'grid-', ['get', 'label']],
              'icon-anchor': 'top-left',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 0.85],
            },
          })
        }
        map.addSource('locations', { type: 'geojson', data: EMPTY })
        map.addSource('markers', { type: 'geojson', data: EMPTY })
        map.addLayer({
          id: 'locations-selected',
          type: 'circle',
          source: 'locations',
          filter: ['==', ['get', 'id'], ''],
          paint: { 'circle-radius': 16, 'circle-color': '#f4f7fb', 'circle-opacity': 0.35 },
        })
        map.addLayer({
          id: 'locations',
          type: 'symbol',
          source: 'locations',
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 12, 1],
          },
        })
        map.addLayer({
          id: 'locations-found',
          type: 'symbol',
          source: 'locations',
          filter: ['==', ['get', 'found'], 'yes'],
          layout: {
            'icon-image': 'found-check',
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': 0.55,
            'icon-offset': [18, -40],
          },
        })
        map.addLayer({
          id: 'user-markers',
          type: 'symbol',
          source: 'markers',
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
        readyRef.current = true
        publish(map)
        renderPopup(map)
        setMapError(null)
      })().catch((error: unknown) => {
        setMapError(error instanceof Error ? error.message : 'Could not load map icons')
      })
    })

    return () => {
      readyRef.current = false
      map.off('mousemove', onMove)
      map.getCanvas().removeEventListener('mouseleave', onLeave)
      popup.remove()
      popupRef.current = null
      popupRootRef.current?.unmount()
      popupRootRef.current = null
      popupHostRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [mapCatalog])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    publish(map)
  })

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    renderPopup(map)
  })

  function publish(map: MapLibreMap) {
    const current = snapshot.current
    const locationSource = map.getSource('locations') as GeoJSONSource | undefined
    const markerSource = map.getSource('markers') as GeoJSONSource | undefined
    if (!locationSource || !markerSource) return
    locationSource.setData({
      type: 'FeatureCollection',
      features: current.locations.map((location) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
        properties: {
          id: location.id,
          title: location.title,
          icon: current.categoryIcon.get(location.categoryId) ?? 'miscellaneous',
          found: current.foundIds.has(location.id) ? 'yes' : 'no',
        },
      })),
    })
    for (const marker of current.markers) {
      const imageId = pinImageId(marker.color)
      if (!map.hasImage(imageId)) map.addImage(imageId, pinImage(marker.color), { pixelRatio: 2 })
    }
    markerSource.setData({
      type: 'FeatureCollection',
      features: current.markers.map((marker) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [marker.longitude, marker.latitude] },
        properties: { id: marker.id, title: marker.title, icon: pinImageId(marker.color) },
      })),
    })
    const selectedId = current.selection?.kind === 'location' ? current.selection.id : ''
    if (map.getLayer('locations-selected')) {
      map.setFilter('locations-selected', ['==', ['get', 'id'], selectedId])
    }
  }

  function renderPopup(map: MapLibreMap) {
    const popup = popupRef.current
    const root = popupRootRef.current
    const host = popupHostRef.current
    if (!popup || !root || !host) return
    const current = popupSnapshot.current
    const selection = current.selection

    if (!selection) {
      fittedSelectionRef.current = null
      if (popup.isOpen()) popup.remove()
      root.render(null)
      return
    }

    let longitude = 0
    let latitude = 0
    let content = null as ReactNode

    if (selection.kind === 'location') {
      const location = current.mapCatalog.locations.find((item) => item.id === selection.id)
      if (!location) {
        if (popup.isOpen()) popup.remove()
        root.render(null)
        return
      }
      longitude = location.longitude
      latitude = location.latitude
      content = (
        <LocationPopup
          key={location.id}
          location={location}
          catalog={current.mapCatalog}
          user={current.user}
          editsLocked={current.editsLocked}
          onToggleFound={current.onToggleFound}
          onSetLocationOre={current.onSetLocationOre}
          onSetLocationComment={current.onSetLocationComment}
          onOpenLocation={current.onSelectLocation}
          onClose={current.onCancel}
        />
      )
    } else if (selection.kind === 'marker') {
      const marker = current.markers.find((item) => item.id === selection.id)
      if (!marker) {
        if (popup.isOpen()) popup.remove()
        root.render(null)
        return
      }
      longitude = marker.longitude
      latitude = marker.latitude
      content = (
        <MarkerPopup
          key={marker.id}
          marker={marker}
          editsLocked={current.editsLocked}
          onSave={current.onSaveMarker}
          onDelete={current.onDeleteMarker}
          onClose={current.onCancel}
        />
      )
    } else {
      longitude = selection.longitude
      latitude = selection.latitude
      content = (
        <MarkerPopup
          key={`${selection.longitude}:${selection.latitude}`}
          marker={{
            id: '',
            title: 'Note',
            notes: '',
            color: '#8b5cf6',
            kind: 'note',
            longitude: selection.longitude,
            latitude: selection.latitude,
          }}
          editsLocked={current.editsLocked}
          onSave={current.onSaveMarker}
          onClose={current.onCancel}
        />
      )
    }

    root.render(content)
    popup.setDOMContent(host).setLngLat([longitude, latitude])
    if (!popup.isOpen()) popup.addTo(map)
    const fitKey =
      selection.kind === 'draft'
        ? `draft:${selection.longitude}:${selection.latitude}`
        : `${selection.kind}:${selection.id}`
    // Re-measure after React paints so auto-anchor uses the real popup size.
    requestAnimationFrame(() => {
      if (!popupRef.current?.isOpen()) return
      popupRef.current.setLngLat([longitude, latitude])
      if (fittedSelectionRef.current === fitKey) return
      fittedSelectionRef.current = fitKey
      keepPopupInView(map, longitude, latitude)
    })
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusKey) return
    const [kind, id] = focusKey.split(':')
    const point =
      kind === 'location'
        ? mapCatalog.locations.find((location) => location.id === id)
        : snapshot.current.markers.find((marker) => marker.id === id)
    if (!point) return
    map.easeTo({
      center: [point.longitude, point.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: 450,
    })
  }, [focusKey, mapCatalog.locations])

  useEffect(() => {
    if (!placing) setGhost(null)
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = placing ? 'none' : map.getCanvas().style.cursor
  }, [placing])

  return (
    <div className={placing ? 'map-frame placing' : 'map-frame'}>
      <div ref={containerRef} className="map" />
      {placing && ghost ? <div className="place-ghost" style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }} aria-hidden="true" /> : null}
      {mapError ? <p className="map-error">{mapError}</p> : null}
    </div>
  )
}
