import { emptyUserData, type UserDataFile } from '../types'

export type StorageMode = 'api' | 'local'

function localKey(gameId: string) {
  return `icarus-map:user:${gameId}`
}

function readLocal(gameId: string): UserDataFile | null {
  try {
    const raw = localStorage.getItem(localKey(gameId))
    if (!raw) return null
    return JSON.parse(raw) as UserDataFile
  } catch {
    return null
  }
}

function writeLocal(gameId: string, file: UserDataFile) {
  localStorage.setItem(localKey(gameId), JSON.stringify(file))
}

function looksLikeJson(raw: string) {
  const trimmed = raw.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

/** Production / Cloudflare: localStorage only. Dev: prefer Vite file API when it returns JSON. */
export async function loadUserFile(gameId: string): Promise<{ file: UserDataFile; mode: StorageMode }> {
  if (import.meta.env.DEV) {
    try {
      const response = await fetch(`/api/user/${gameId}`)
      const raw = await response.text()
      if (response.ok && looksLikeJson(raw)) {
        return { file: JSON.parse(raw) as UserDataFile, mode: 'api' }
      }
    } catch {
      // fall through — never surface HTML/doctype as a user-facing error
    }
  }
  return { file: readLocal(gameId) ?? emptyUserData(), mode: 'local' }
}

export async function saveUserFile(gameId: string, file: UserDataFile, mode: StorageMode): Promise<StorageMode> {
  if (mode === 'api' && import.meta.env.DEV) {
    try {
      const response = await fetch(`/api/user/${gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      })
      if (response.status === 409) throw new Error('Another change was saved first. Reload the page.')
      const raw = await response.text()
      if (response.ok && (!raw || looksLikeJson(raw))) {
        // Mirror to localStorage so a later static deploy still has a copy.
        writeLocal(gameId, file)
        return 'api'
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Another change')) throw error
    }
  }
  writeLocal(gameId, file)
  return 'local'
}

export function flushUserFile(gameId: string, file: UserDataFile, mode: StorageMode) {
  if (mode === 'local' || !import.meta.env.DEV) {
    writeLocal(gameId, file)
    return
  }
  void fetch(`/api/user/${gameId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(file),
    keepalive: true,
  }).catch(() => {
    writeLocal(gameId, file)
  })
}
