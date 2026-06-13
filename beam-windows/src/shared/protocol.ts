/**
 * Beam wire protocol — shared between the Electron main process and the renderer.
 * Authoritative spec: ../../../PROTOCOL.md
 */

export const BEAM_PROTOCOL_VERSION = 1
export const DEFAULT_PORT = 8787

/** Frame header: [uint32 length][uint8 flags]. */
export const HEADER_SIZE = 5

export const FrameFlags = {
  KEYFRAME: 0x01,
  CONFIG: 0x02
} as const

/** The HELLO handshake the phone sends as the first line. */
export interface Hello {
  beam: number
  device: string
  width: number
  height: number
  fps: number
  codec: string
}

/** A reassembled video frame handed from main → renderer. */
export interface BeamFrame {
  flags: number
  /** H.264 Annex-B payload. */
  data: Uint8Array
}

export function isKeyframe(flags: number): boolean {
  return (flags & FrameFlags.KEYFRAME) !== 0
}

export function isConfig(flags: number): boolean {
  return (flags & FrameFlags.CONFIG) !== 0
}

export function parseHello(line: string): Hello {
  const obj = JSON.parse(line) as Partial<Hello>
  if (obj.beam !== BEAM_PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version: ${obj.beam} (expected ${BEAM_PROTOCOL_VERSION})`)
  }
  if (!obj.codec || typeof obj.width !== 'number' || typeof obj.height !== 'number') {
    throw new Error('Malformed HELLO: missing codec/width/height')
  }
  return {
    beam: obj.beam,
    device: obj.device ?? 'Android device',
    width: obj.width,
    height: obj.height,
    fps: typeof obj.fps === 'number' && obj.fps > 0 ? obj.fps : 60,
    codec: obj.codec
  }
}

/** Connection status surfaced to the renderer for the UI. */
export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'handshaking'
  | 'streaming'
  | 'reconnecting'
  | 'error'

export interface ConnectionStatus {
  phase: ConnectionPhase
  /** Populated once HELLO is received. */
  hello?: Hello
  /** Human-readable error (when phase === 'error'). */
  message?: string
}

export interface ConnectOptions {
  host: string
  port: number
  code: string
}
