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

/** The API surface exposed to the renderer on `window.beam` (see preload). */
export interface BeamApi {
  connect(opts: ConnectOptions): Promise<void>
  disconnect(): Promise<void>
  /** Subscribe to connection status updates. Returns an unsubscribe function. */
  onStatus(cb: (status: ConnectionStatus) => void): () => void

  /** One-click install of the Android app over USB (adb). */
  android: {
    detect(): Promise<DeviceInfo>
    install(): Promise<InstallResult>
    onProgress(cb: (p: InstallProgress) => void): () => void
  }
}
