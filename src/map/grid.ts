import type { MapGrid } from '../types'

export function cellLabel(grid: MapGrid, longitude: number, latitude: number): string | null {
  const column = Math.floor((longitude - grid.west) / grid.size)
  const row = Math.floor((grid.north - latitude) / grid.size)
  if (column < 0 || row < 0 || column >= grid.columns.length || row >= grid.rowCount) return null
  const letter = grid.columns[column]
  if (!letter) return null
  return `${letter}${row + 1}`
}

export function gridLineCollection(grid: MapGrid): GeoJSON.FeatureCollection {
  const south = grid.north - grid.rowCount * grid.size
  const east = grid.west + grid.columns.length * grid.size
  const features: GeoJSON.Feature[] = []
  for (let column = 0; column <= grid.columns.length; column += 1) {
    const longitude = grid.west + column * grid.size
    features.push(line([[longitude, grid.north], [longitude, south]]))
  }
  for (let row = 0; row <= grid.rowCount; row += 1) {
    const latitude = grid.north - row * grid.size
    features.push(line([[grid.west, latitude], [east, latitude]]))
  }
  return { type: 'FeatureCollection', features }
}

export function gridLabelCollection(grid: MapGrid): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (let column = 0; column < grid.columns.length; column += 1) {
    for (let row = 0; row < grid.rowCount; row += 1) {
      const letter = grid.columns[column]
      if (!letter) continue
      // Top-left of the cell so pins in the middle do not cover the label.
      features.push({
        type: 'Feature',
        properties: { label: `${letter}${row + 1}` },
        geometry: {
          type: 'Point',
          coordinates: [grid.west + (column + 0.14) * grid.size, grid.north - (row + 0.14) * grid.size],
        },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

export function gridLabelImage(text: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = 112
  canvas.height = 48
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw a grid label')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.font = '700 30px "Segoe UI", sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.lineJoin = 'round'
  context.lineWidth = 6
  context.strokeStyle = 'rgba(12, 16, 22, 0.9)'
  context.strokeText(text, 4, 4)
  context.fillStyle = '#f0b429'
  context.fillText(text, 4, 4)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function line(coordinates: [number, number][]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates },
  }
}
