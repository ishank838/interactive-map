import { useState } from 'react'
import { BASE_PROFILE_NAME, isBaseProfile, type Profile } from '../types'

const MAX_NAME = 40
const MAX_PROFILES = 20

type ProfileControlProps = {
  profiles: Profile[]
  activeProfileId: string
  disabled: boolean
  onSelect: (profileId: string) => void
  onCreate: (name: string) => void
  onDelete: (profileId: string) => void
}

export function ProfileControl(props: ProfileControlProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const active = props.profiles.find((profile) => profile.id === props.activeProfileId)
  const activeIsBase = active ? isBaseProfile(active.id) : false
  const customCount = props.profiles.filter((profile) => !isBaseProfile(profile.id)).length

  function create() {
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Add a profile name.')
      return
    }
    if (trimmed.length > MAX_NAME) {
      setFormError('That name is too long.')
      return
    }
    if (trimmed.toLowerCase() === BASE_PROFILE_NAME.toLowerCase()) {
      setFormError('Base is reserved. Pick another name.')
      return
    }
    props.onCreate(trimmed)
    setName('')
    setCreating(false)
    setFormError(null)
  }

  function remove() {
    if (!active || isBaseProfile(active.id)) return
    const confirmed = window.confirm(`Delete profile “${active.name}”? Its markers and found locations for this game will be removed.`)
    if (!confirmed) return
    props.onDelete(active.id)
  }

  return (
    <div className="profile-control">
      <label className="map-picker">
        <span>Profile</span>
        <select
          value={props.activeProfileId}
          disabled={props.disabled || props.profiles.length === 0}
          onChange={(event) => props.onSelect(event.target.value)}
        >
          {props.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {isBaseProfile(profile.id) ? BASE_PROFILE_NAME : profile.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => setCreating(true)} disabled={props.disabled || props.profiles.length >= MAX_PROFILES}>
        New
      </button>
      <button
        type="button"
        className="danger"
        onClick={remove}
        disabled={props.disabled || activeIsBase || customCount < 1}
        title={activeIsBase ? 'Base cannot be deleted' : undefined}
      >
        Delete
      </button>
      {creating ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create()
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Profile name"
            maxLength={MAX_NAME}
            autoFocus
            disabled={props.disabled}
            aria-label="Profile name"
          />
          <button type="submit" disabled={props.disabled}>
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false)
              setFormError(null)
            }}
          >
            Cancel
          </button>
          {formError ? <p className="form-error">{formError}</p> : null}
        </form>
      ) : null}
    </div>
  )
}
