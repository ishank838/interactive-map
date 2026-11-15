import olympus from './games/icarus/olympus.json'
import { olympusGrid } from './games/icarus/grid'
import type { GameCatalog, MapCatalog } from '../types'

export const games: GameCatalog[] = [
  {
    id: 'icarus',
    title: 'ICARUS',
    maps: [{ ...(olympus as MapCatalog), grid: olympusGrid }],
  },
]

export function findGame(gameId: string): GameCatalog | undefined {
  return games.find((game) => game.id === gameId)
}
