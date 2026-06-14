const KEY = 'beam:recents'

export interface Recent {
  host: string
  port: number
  device?: string
  code?: string // remembered pairing code, so a known device reconnects without re-typing
  at: number
}

export function loadRecents(): Recent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as Recent[]) : []
  } catch {
    return []
  }
}

export function addRecent(r: Recent): void {
  const list = loadRecents().filter((x) => !(x.host === r.host && x.port === r.port))
  list.unshift(r)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5)))
}
