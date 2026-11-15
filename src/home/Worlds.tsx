import { useEffect } from 'react'
import { ProfileControl } from '../profiles/ProfileControl'
import type { UserDataApi } from '../state/userData'
import type { GameCatalog } from '../types'

type WorldsProps = {
  game: GameCatalog
  user: UserDataApi
  onHome: () => void
  onOpen: (mapId: string) => void
}

export function Worlds(props: WorldsProps) {
  const { data, status, error, selectProfile, createProfile, deleteProfile } = props.user

  useEffect(() => {
    document.title = props.game.title
  }, [props.game.title])

  const statusLabel = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'loading' ? 'Loading profiles…' : ''

  return (
    <main className="home">
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
      </p>
      <h1>{props.game.title}</h1>
      <p className="home-lead">Choose a world. Base is the catalog; create a profile to keep markers and details.</p>
      <ProfileControl
        profiles={data?.profiles ?? []}
        activeProfileId={data?.activeProfileId ?? ''}
        disabled={!data}
        onSelect={selectProfile}
        onCreate={createProfile}
        onDelete={deleteProfile}
      />
      {props.user.onBase ? (
        <p className="profile-hint">You are on Base. Filters can be tried this session; saved notes need a profile.</p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <ul className="game-list">
        {props.game.maps.map((map) => (
          <li key={map.mapId}>
            <a
              className="game-card"
              href={`/${props.game.id}/${map.mapId}`}
              onClick={(event) => {
                event.preventDefault()
                props.onOpen(map.mapId)
              }}
            >
              <span className="game-card-title">{map.title}</span>
              <span className="game-card-meta">{map.locations.length} locations</span>
            </a>
          </li>
        ))}
      </ul>
      {statusLabel ? <p className="status">{statusLabel}</p> : null}
    </main>
  )
}
