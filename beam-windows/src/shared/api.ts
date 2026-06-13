import type { ConnectOptions, ConnectionStatus } from './protocol'

/** The API surface exposed to the renderer on `window.beam` (see preload). */
export interface BeamApi {
  connect(opts: ConnectOptions): Promise<void>
  disconnect(): Promise<void>
  /** Subscribe to connection status updates. Returns an unsubscribe function. */
  onStatus(cb: (status: ConnectionStatus) => void): () => void
}
