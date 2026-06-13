import { isConfig, isKeyframe } from '../../shared/protocol'
import type { Hello } from '../../shared/protocol'

/**
 * Decodes the Beam H.264 stream with WebCodecs and paints each frame to a canvas.
 *
 * Input is Annex-B (start codes included), so the VideoDecoder is configured
 * WITHOUT a `description` — Chromium then treats chunks as Annex-B. The phone
 * sends SPS/PPS once as a CONFIG frame; we cache it and prepend it to the next
 * keyframe so every key chunk is self-contained and reconnects self-heal.
 */
export class BeamDecoder {
  private decoder: VideoDecoder | null = null
  private readonly ctx: CanvasRenderingContext2D | null
  private config: Uint8Array | null = null
  private gotKey = false
  private fps = 60
  private ts = 0

  private framesDrawn = 0
  private lastStatsAt = 0
  private onStats?: (fps: number) => void
  private onError?: (message: string) => void

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })
  }

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'VideoDecoder' in window
  }

  setOnStats(cb: (fps: number) => void): void {
    this.onStats = cb
  }

  setOnError(cb: (message: string) => void): void {
    this.onError = cb
  }

  start(hello: Pick<Hello, 'width' | 'height' | 'fps' | 'codec'>): void {
    this.fps = hello.fps > 0 ? hello.fps : 60
    this.canvas.width = hello.width
    this.canvas.height = hello.height
    this.resetState()

    this.decoder = new VideoDecoder({
      output: (frame) => this.draw(frame),
      error: (e) => this.onError?.(e.message)
    })
    this.decoder.configure({
      codec: hello.codec,
      optimizeForLatency: true,
      hardwareAcceleration: 'prefer-hardware'
    })
  }

  /** Feed one wire frame (flags + Annex-B payload). */
  push(flags: number, data: Uint8Array): void {
    if (!this.decoder) return

    if (isConfig(flags)) {
      this.config = data
      return
    }

    const key = isKeyframe(flags)
    if (!this.gotKey) {
      if (!key) return // deltas before the first keyframe are undecodable
      this.gotKey = true
    }

    let payload = data
    if (key && this.config) {
      payload = new Uint8Array(this.config.length + data.length)
      payload.set(this.config, 0)
      payload.set(data, this.config.length)
    }

    const chunk = new EncodedVideoChunk({
      type: key ? 'key' : 'delta',
      timestamp: this.ts,
      data: payload
    })
    this.ts += Math.round(1_000_000 / this.fps)

    try {
      this.decoder.decode(chunk)
    } catch (e) {
      this.onError?.((e as Error).message)
    }
  }

  private draw(frame: VideoFrame): void {
    if (this.ctx) {
      this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height)
    }
    frame.close()

    this.framesDrawn++
    const now = performance.now()
    if (now - this.lastStatsAt >= 1000) {
      this.onStats?.(this.framesDrawn)
      this.framesDrawn = 0
      this.lastStatsAt = now
    }
  }

  private resetState(): void {
    this.gotKey = false
    this.config = null
    this.ts = 0
    this.framesDrawn = 0
    this.lastStatsAt = performance.now()
  }

  stop(): void {
    try {
      this.decoder?.close()
    } catch {
      // already closed
    }
    this.decoder = null
    this.resetState()
  }
}
