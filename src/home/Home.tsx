import { useEffect } from 'react'
import type { GameCatalog } from '../types'

type HomeProps = {
  games: GameCatalog[]
  onOpen: (gameId: string) => void
}

export function Home(props: HomeProps) {
  useEffect(() => {
    document.title = 'Maps'
  }, [])

  return (
    <main className="home">
      <h1>Choose a game</h1>
      <p className="home-lead">Open a game, then choose a world. Each game keeps its own profiles.</p>
      <ul className="game-list">
        {props.games.map((game) => {
          const locations = game.maps.reduce((count, map) => count + map.locations.length, 0)
          const mapNames = game.maps.map((map) => map.title).join(', ')
          return (
            <li key={game.id}>
              <a
                className="game-card"
                href={`/${game.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  props.onOpen(game.id)
                }}
              >
                <span className="game-card-title">{game.title}</span>
                <span className="game-card-meta">
                  {mapNames} · {locations} locations
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
