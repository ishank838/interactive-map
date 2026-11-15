import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BASE_PROFILE_ID,
  BASE_PROFILE_NAME,
  baseProfile,
  coerceMapUser,
  isBaseProfile,
  type MapUserState,
  type Profile,
  type UserDataFile,
} from '../types'

const MAX_PROFILES = 20
const MAX_PROFILE_NAME = 40

type SaveStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'error'

export type MapUpdateKind = 'filter' | 'custom'

export type UserDataApi = ReturnType<typeof useUserData>

function mapHasCustomizations(map: MapUserState) {
  return (
    map.found.length > 0 ||
    map.markers.length > 0 ||
    Object.keys(map.ores).length > 0 ||
    Object.keys(map.comments).length > 0
  )
}

function ensureBaseProfile(file: UserDataFile): { file: UserDataFile; changed: boolean } {
  let changed = false
  let profiles = [...file.profiles]
  const baseIndex = profiles.findIndex((profile) => profile.id === BASE_PROFILE_ID)

  if (baseIndex < 0) {
    profiles = [baseProfile(), ...profiles]
    changed = true
  } else {
    const current = profiles[baseIndex]
    if (!current) return { file, changed: false }
    const maps = current.maps ?? {}
    const hasCustom = Object.values(maps).some((map) => mapHasCustomizations(coerceMapUser(map)))
    if (hasCustom) {
      const imported: Profile = {
        id: crypto.randomUUID(),
        name: 'Imported',
        maps: Object.fromEntries(Object.entries(maps).map(([mapId, map]) => [mapId, coerceMapUser(map)])),
      }
      profiles[baseIndex] = baseProfile()
      profiles.push(imported)
      changed = true
    } else if (current.name !== BASE_PROFILE_NAME || Object.keys(maps).length > 0) {
      profiles[baseIndex] = baseProfile()
      changed = true
    }
  }

  const activeProfileId = profiles.some((profile) => profile.id === file.activeProfileId)
    ? file.activeProfileId
    : BASE_PROFILE_ID
  if (activeProfileId !== file.activeProfileId) changed = true

  return { file: { ...file, profiles, activeProfileId }, changed }
}

export function useUserData(gameId: string) {
  const [data, setData] = useState<UserDataFile | null>(null)
  const [sessionMaps, setSessionMaps] = useState<Record<string, MapUserState>>({})
  const [status, setStatus] = useState<SaveStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef<UserDataFile | null>(null)
  const sessionMapsRef = useRef<Record<string, MapUserState>>({})
  const timer = useRef<number | null>(null)
  const pending = useRef(false)
  const queue = useRef(Promise.resolve())

  const persist = useCallback(
    async (file: UserDataFile) => {
      const response = await fetch(`/api/user/${gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      })
      if (response.status === 409) throw new Error('Another change was saved first. Reload the page.')
      if (!response.ok) throw new Error((await response.text()) || 'Could not save')
    },
    [gameId],
  )

  const enqueueSave = useCallback(() => {
    queue.current = queue.current
      .then(async () => {
        const latest = dataRef.current
        if (!latest) return
        await persist(latest)
        if (!pending.current) {
          setStatus('saved')
          setError(null)
        }
      })
      .catch((saveError: unknown) => {
        setStatus('error')
        setError(saveError instanceof Error ? saveError.message : 'Could not save')
      })
  }, [persist])

  const commit = useCallback(
    (next: UserDataFile) => {
      const { file: cleaned } = ensureBaseProfile(next)
      const revision = (dataRef.current?.revision ?? cleaned.revision) + 1
      const withRevision = { ...cleaned, revision }
      dataRef.current = withRevision
      setData(withRevision)
      pending.current = true
      setStatus('saving')
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        pending.current = false
        enqueueSave()
      }, 400)
    },
    [enqueueSave],
  )

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)
    setSessionMaps({})
    sessionMapsRef.current = {}
    void fetch(`/api/user/${gameId}`)
      .then(async (response) => {
        const raw = await response.text()
        if (!response.ok) throw new Error(raw || 'Could not load your notes')
        let file: UserDataFile
        try {
          file = JSON.parse(raw) as UserDataFile
        } catch {
          throw new Error('Profile API is not available. Run this app with `npm run dev` (not a static host).')
        }
        return file
      })
      .then((file) => {
        if (cancelled) return
        const { file: next, changed } = ensureBaseProfile(file)
        dataRef.current = next
        setData(next)
        setStatus('ready')
        if (changed) commit(next)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setStatus('error')
        setError(loadError instanceof Error ? loadError.message : 'Could not load your notes')
      })
    return () => {
      cancelled = true
    }
  }, [gameId, commit])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      const latest = dataRef.current
      if (!latest || !pending.current) return
      pending.current = false
      void persist(latest)
    }
  }, [persist])

  useEffect(() => {
    const flush = () => {
      const latest = dataRef.current
      if (!latest || !pending.current) return
      if (timer.current) window.clearTimeout(timer.current)
      pending.current = false
      void fetch(`/api/user/${gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latest),
        keepalive: true,
      })
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [gameId])

  const activeProfileId = data?.activeProfileId ?? BASE_PROFILE_ID
  const onBase = isBaseProfile(activeProfileId)

  const updateMap = useCallback(
    (mapId: string, recipe: (current: MapUserState) => MapUserState, kind: MapUpdateKind = 'custom') => {
      const prev = dataRef.current
      if (!prev) return
      if (isBaseProfile(prev.activeProfileId)) {
        if (kind === 'custom') return
        const current = coerceMapUser(sessionMapsRef.current[mapId])
        const nextSession = { ...sessionMapsRef.current, [mapId]: recipe(current) }
        sessionMapsRef.current = nextSession
        setSessionMaps(nextSession)
        return
      }
      const profile = prev.profiles.find((item) => item.id === prev.activeProfileId)
      if (!profile || isBaseProfile(profile.id)) return
      const current = coerceMapUser(profile.maps[mapId])
      const nextProfile = { ...profile, maps: { ...profile.maps, [mapId]: recipe(current) } }
      commit({
        ...prev,
        profiles: prev.profiles.map((item) => (item.id === nextProfile.id ? nextProfile : item)),
      })
    },
    [commit],
  )

  const selectProfile = useCallback(
    (profileId: string) => {
      const prev = dataRef.current
      if (!prev || prev.activeProfileId === profileId) return
      if (!prev.profiles.some((profile) => profile.id === profileId)) return
      setSessionMaps({})
      sessionMapsRef.current = {}
      commit({ ...prev, activeProfileId: profileId })
    },
    [commit],
  )

  const createProfile = useCallback(
    (name: string) => {
      const prev = dataRef.current
      if (!prev || prev.profiles.length >= MAX_PROFILES) return
      const trimmed = name.trim()
      if (!trimmed || trimmed.length > MAX_PROFILE_NAME) return
      if (trimmed.toLowerCase() === BASE_PROFILE_NAME.toLowerCase()) return
      const profile = { id: crypto.randomUUID(), name: trimmed, maps: {} }
      setSessionMaps({})
      sessionMapsRef.current = {}
      commit({
        ...prev,
        activeProfileId: profile.id,
        profiles: [...prev.profiles, profile],
      })
    },
    [commit],
  )

  const deleteProfile = useCallback(
    (profileId: string) => {
      if (isBaseProfile(profileId)) return
      const prev = dataRef.current
      if (!prev) return
      const profiles = prev.profiles.filter((profile) => profile.id !== profileId)
      if (profiles.length === prev.profiles.length) return
      if (!profiles.some((profile) => profile.id === BASE_PROFILE_ID)) profiles.unshift(baseProfile())
      setSessionMaps({})
      sessionMapsRef.current = {}
      commit({
        ...prev,
        profiles,
        activeProfileId: prev.activeProfileId === profileId ? BASE_PROFILE_ID : prev.activeProfileId,
      })
    },
    [commit],
  )

  return {
    data,
    status,
    error,
    onBase,
    sessionMaps,
    updateMap,
    selectProfile,
    createProfile,
    deleteProfile,
  }
}
