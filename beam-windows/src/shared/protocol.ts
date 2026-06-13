/**
 * Beam wire protocol v2 — shared between the Electron main process and the renderer.
 * Authoritative spec: ../../../PROTOCOL.md
 *
 * The single socket is multiplexed into channels. Frame header is
 * [uint32 length][uint8 channel][uint8 type]; channel 0 = VIDEO (type = flag bits),
 * channel 1 = CONTROL (type 0 = JSON message).
 */

export const BEAM_PROTOCOL_VERSION = 2
export const DEFAULT_PORT = 8787

/** Frame header: [uint32 length][uint8 channel][uint8 type]. */
export const HEADER_SIZE = 6

export const Channel = {
  VIDEO: 0,
  CONTROL: 1
} as const

/** Channel 0 (video) `type` bitfield. */
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
  /** Physical display size + rotation, for mapping control taps to device pixels. */
  physWidth: number
  physHeight: number
  rotation: number
  fps: number
  codec: string
  /** Channels this phone supports this session; always includes "video". */
  channels: string[]
}

/** A reassembled frame handed off the socket. */
export interface BeamFrame {
  channel: number
  /** Channel 0: video flag bits. Channel 1: message type (0 = JSON). */
  type: number
  data: Uint8Array
}

export function isKeyframe(type: number): boolean {
  return (type & FrameFlags.KEYFRAME) !== 0
}

export function isConfig(type: number): boolean {
  return (type & FrameFlags.CONFIG) !== 0
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
    physWidth: typeof obj.physWidth === 'number' ? obj.physWidth : obj.width,
    physHeight: typeof obj.physHeight === 'number' ? obj.physHeight : obj.height,
    rotation: typeof obj.rotation === 'number' ? obj.rotation : 0,
    fps: typeof obj.fps === 'number' && obj.fps > 0 ? obj.fps : 60,
    codec: obj.codec,
    channels: Array.isArray(obj.channels) ? obj.channels : ['video']
  }
}

/** A CONTROL-channel message (JSON payload). */
export interface ControlRequest {
  id: number
  op: string
  args?: Record<string, unknown>
}
export interface ControlResponse {
  id: number
  ok: boolean
  result?: unknown
  error?: string
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
