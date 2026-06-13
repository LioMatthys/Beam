import net from 'node:net'
import { FrameParser } from './frame-parser'
import { parseHello } from '../shared/protocol'
import type { BeamFrame, ConnectOptions, ConnectionStatus, Hello } from '../shared/protocol'

const NEWLINE = 0x0a
const BACKOFF_MIN = 250
const BACKOFF_MAX = 4000

type StatusFn = (status: ConnectionStatus) => void
type FrameFn = (frame: BeamFrame) => void

/**
 * Owns the TCP socket to the phone: connect → read HELLO → send pairing code →
 * stream length-prefixed H.264 frames. Auto-reconnects with backoff while the
 * user intends to stay connected. Frames are pushed out via `onFrame` (the caller
 * forwards them to the renderer over a MessagePort).
 */
export class Connection {
  private socket: net.Socket | null = null
  private parser = new FrameParser()
  private opts: ConnectOptions | null = null
  private desired = false
  private backoff = BACKOFF_MIN
  private reconnectTimer: NodeJS.Timeout | null = null

  // Handshake state for the current socket.
  private gotHello = false
  private helloBuf: number[] = []
  private hello: Hello | null = null

  constructor(
    private readonly onStatus: StatusFn,
    private readonly onFrame: FrameFn
  ) {}

  connect(opts: ConnectOptions): void {
    this.opts = opts
    this.desired = true
    this.backoff = BACKOFF_MIN
    this.openSocket()
  }

  disconnect(): void {
    this.desired = false
    this.clearReconnect()
    this.teardownSocket()
    this.onStatus({ phase: 'idle' })
  }

  private openSocket(): void {
    if (!this.opts) return
    this.resetHandshake()
    this.onStatus({ phase: this.backoff === BACKOFF_MIN ? 'connecting' : 'reconnecting' })

    const socket = net.createConnection({ host: this.opts.host, port: this.opts.port })
    this.socket = socket
    socket.setNoDelay(true)

    socket.on('connect', () => {
      this.backoff = BACKOFF_MIN
      this.onStatus({ phase: 'handshaking' })
    })
    socket.on('data', (chunk) => this.onData(chunk))
    socket.on('error', (err) => this.onSocketError(err))
    socket.on('close', () => this.onSocketClose())
  }

  private onData(chunk: Buffer): void {
    if (!this.gotHello) {
      // Accumulate bytes until the first newline — that's the HELLO JSON line.
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === NEWLINE) {
          const line = Buffer.from(this.helloBuf).toString('utf8')
          this.helloBuf = []
          this.gotHello = true
          try {
            this.hello = parseHello(line)
          } catch (err) {
            this.fail((err as Error).message)
            return
          }
          this.onStatus({ phase: 'streaming', hello: this.hello })
          this.sendCode()
          // Any bytes after the newline are the start of the frame stream.
          const rest = chunk.subarray(i + 1)
          if (rest.length) this.handleFrames(rest)
          return
        }
        this.helloBuf.push(chunk[i])
        if (this.helloBuf.length > 4096) {
          this.fail('HELLO line too long — not a Beam server?')
          return
        }
      }
      return
    }
    this.handleFrames(chunk)
  }

  private handleFrames(chunk: Buffer): void {
    const frames = this.parser.push(chunk)
    for (const f of frames) this.onFrame(f)
  }

  private sendCode(): void {
    if (this.socket && this.opts) {
      this.socket.write(`${this.opts.code}\n`)
    }
  }

  private onSocketError(err: Error): void {
    if (!this.desired) return
    this.onStatus({ phase: 'error', message: err.message })
  }

  private onSocketClose(): void {
    this.teardownSocket()
    if (this.desired) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    this.clearReconnect()
    this.onStatus({ phase: 'reconnecting' })
    this.reconnectTimer = setTimeout(() => {
      this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX)
      this.openSocket()
    }, this.backoff)
  }

  private fail(message: string): void {
    this.onStatus({ phase: 'error', message })
    this.teardownSocket()
    if (this.desired) this.scheduleReconnect()
  }

  private resetHandshake(): void {
    this.parser.reset()
    this.gotHello = false
    this.helloBuf = []
    this.hello = null
  }

  private teardownSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.destroy()
      this.socket = null
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
