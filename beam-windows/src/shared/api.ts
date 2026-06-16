import type { ConnectOptions, ConnectionStatus } from './protocol'

export type DeviceState = 'none' | 'unauthorized' | 'ready'

export interface DeviceInfo {
  state: DeviceState
  serial?: string
  model?: string
}

export interface InstallProgress {
  phase: 'detecting' | 'downloading' | 'installing' | 'launching' | 'done'
  message: string
  percent?: number
}

export interface InstallResult {
  ok: boolean
  model?: string
  error?: string
}

export interface NetInfo {
  /** This PC's primary LAN IPv4, e.g. "192.168.1.20" (empty if none found). */
  ip: string
  /** Connected Wi-Fi network name (SSID), if on Wi-Fi; empty otherwise. */
  ssid: string
}

/** The API surface exposed to the renderer on `window.beam` (see preload). */
export interface BeamApi {
  connect(opts: ConnectOptions): Promise<void>
  disconnect(): Promise<void>
  /** Subscribe to connection status updates. Returns an unsubscribe function. */
  onStatus(cb: (status: ConnectionStatus) => void): () => void

  /** Send a one-off control op to the phone (e.g. tap from a cast-video click). */
  control(op: string, args?: Record<string, unknown>): Promise<{ ok: boolean }>

  /** This PC's LAN network info, for the same-network sanity check on the connect screen. */
  netInfo(): Promise<NetInfo>

  /** Copy text to the system clipboard (e.g. the agent instruction prompt). */
  copyText(text: string): Promise<void>

  /** One-click install of the Android app over USB (adb). */
  android: {
    detect(): Promise<DeviceInfo>
    install(): Promise<InstallResult>
    onProgress(cb: (p: InstallProgress) => void): () => void
  }
}
