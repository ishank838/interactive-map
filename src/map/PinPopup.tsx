import { useState } from 'react'
import { DEEP_ORES, isDeepMiningCategory, oreTitle } from '../catalog/ores'
import { cellLabel } from './grid'
import { RichText } from '../text/RichText'
import {
  MARKER_COLORS,
  MARKER_KINDS,
  isMarkerKind,
  type CatalogLocation,
  type MapCatalog,
  type MapUserState,
  type MarkerKind,
  type UserMarker,
} from '../types'

const MAX_COMMENT = 4000

type LocationPopupProps = {
  location: CatalogLocation
  catalog: MapCatalog
  user: MapUserState
  editsLocked: boolean
  onToggleFound: (locationId: string) => void
  onSetLocationOre: (locationId: string, oreId: string) => void
  onSetLocationComment: (locationId: string, comment: string) => void
  onOpenLocation: (locationId: string) => void
  onClose: () => void
}

export function LocationPopup(props: LocationPopupProps) {
  const category = props.catalog.groups.flatMap((group) => group.categories).find((item) => item.id === props.location.categoryId)
  const grid = props.catalog.grid
    ? cellLabel(props.catalog.grid, props.location.longitude, props.location.latitude)
    : null
  const tagged = oreTitle(props.user.ores[props.location.id])
  const savedComment = props.user.comments[props.location.id] ?? ''
  const [comment, setComment] = useState(savedComment)
  const [savedFlash, setSavedFlash] = useState(false)

  return (
    <div className="pin-popup">
      <div className="detail-title">
        <h2>{props.location.title}</h2>
        <button type="button" onClick={props.onClose} aria-label="Close details">
          Close
        </button>
      </div>
      <p className="detail-category">
        {category?.title ?? 'Location'}
        {grid ? ` · ${grid}` : ''}
        {tagged ? ` · ${tagged}` : ''}
      </p>
      <label className="check-row pin-found">
        <input
          type="checkbox"
          checked={props.user.found.includes(props.location.id)}
          onChange={() => props.onToggleFound(props.location.id)}
          disabled={props.editsLocked}
        />
        Found
      </label>
      {isDeepMiningCategory(category) ? (
        <label className="ore-picker">
          <span>Ore rolled</span>
          <select
            value={props.user.ores[props.location.id] ?? ''}
            onChange={(event) => props.onSetLocationOre(props.location.id, event.target.value)}
            disabled={props.editsLocked}
          >
            <option value="">Not set</option>
            {DEEP_ORES.map((ore) => (
              <option key={ore.id} value={ore.id}>
                {ore.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {props.location.description ? (
        <RichText text={props.location.description} onOpenLocation={props.onOpenLocation} />
      ) : (
        <p className="empty">{category?.info ?? 'No notes for this location.'}</p>
      )}
      <label className="comment-field">
        <span>Your comment</span>
        <textarea
          value={comment}
          onChange={(event) => {
            setComment(event.target.value)
            setSavedFlash(false)
          }}
          maxLength={MAX_COMMENT}
          rows={3}
          placeholder={props.editsLocked ? 'Create a profile to leave a comment' : 'Drop a note for yourself…'}
          disabled={props.editsLocked}
        />
      </label>
      <div className="form-actions">
        <button
          type="button"
          disabled={props.editsLocked || comment === savedComment}
          onClick={() => {
            props.onSetLocationComment(props.location.id, comment.trim())
            setComment(comment.trim())
            setSavedFlash(true)
          }}
        >
          Save comment
        </button>
        {savedFlash ? <span className="comment-saved">Saved</span> : null}
      </div>
    </div>
  )
}

type MarkerPopupProps = {
  marker: UserMarker
  editsLocked: boolean
  onSave: (marker: UserMarker) => void
  onDelete?: (markerId: string) => void
  onClose: () => void
}

export function MarkerPopup(props: MarkerPopupProps) {
  const [title, setTitle] = useState(props.marker.title)
  const [notes, setNotes] = useState(props.marker.notes)
  const [color, setColor] = useState(props.marker.color)
  const [kind, setKind] = useState<MarkerKind>(props.marker.kind || 'note')
  const [formError, setFormError] = useState<string | null>(null)
  const isNew = !props.marker.id

  function applyKind(next: MarkerKind) {
    setKind(next)
    const preset = MARKER_KINDS.find((item) => item.id === next)
    if (!preset) return
    setColor(preset.color)
    if (!title.trim() || MARKER_KINDS.some((item) => item.title === title.trim())) {
      setTitle(preset.title)
    }
  }

  return (
    <form
      className="pin-popup marker-form"
      onSubmit={(event) => {
        event.preventDefault()
        const nextTitle = title.trim() || MARKER_KINDS.find((item) => item.id === kind)?.title || 'Note'
        if (nextTitle.length > 120 || notes.length > MAX_COMMENT) {
          setFormError('Title or comments are too long.')
          return
        }
        if (!isMarkerKind(kind)) {
          setFormError('Pick a marker type.')
          return
        }
        props.onSave({
          ...props.marker,
          id: props.marker.id || crypto.randomUUID(),
          title: nextTitle,
          notes,
          color,
          kind,
        })
      }}
    >
      <div className="detail-title">
        <h2>{isNew ? 'New marker' : 'Edit marker'}</h2>
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </div>

      <div className="kind-row" role="group" aria-label="Marker type">
        {MARKER_KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={kind === item.id ? 'kind-chip selected' : 'kind-chip'}
            disabled={props.editsLocked}
            onClick={() => applyKind(item.id)}
          >
            <span className="kind-dot" style={{ background: item.color }} />
            {item.title}
          </button>
        ))}
      </div>

      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} autoFocus disabled={props.editsLocked} />
      </label>
      <label className="comment-field">
        <span>Comment</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={MAX_COMMENT}
          rows={3}
          placeholder="What should you remember here?"
          disabled={props.editsLocked}
        />
      </label>
      <div className="color-row" role="group" aria-label="Marker color">
        {MARKER_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={color === swatch ? 'swatch-button selected' : 'swatch-button'}
            style={{ background: swatch }}
            aria-label={swatch}
            aria-pressed={color === swatch}
            disabled={props.editsLocked}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>
      {formError ? <p className="form-error">{formError}</p> : null}
      <div className="form-actions">
        <button type="submit" disabled={props.editsLocked}>
          {isNew ? 'Drop marker' : 'Save marker'}
        </button>
        {props.onDelete && props.marker.id ? (
          <button type="button" className="danger" onClick={() => props.onDelete?.(props.marker.id)} disabled={props.editsLocked}>
            Delete
          </button>
        ) : null}
      </div>
    </form>
  )
}
