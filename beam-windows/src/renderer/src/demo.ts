import { BeamDecoder } from './decoder'
import { FrameFlags } from '../../shared/protocol'
import { palette } from './theme'

export interface DemoHandle {
  stop(): void
}

const W = 720
const H = 1280
const FPS = 30
const CODEC = 'avc1.42E01F' // H.264 Baseline, level 3.1

/**
 * Local encode → decode loopback. Encodes a synthetic animation to Annex-B H.264
 * with WebCodecs, then feeds the chunks straight into a real BeamDecoder. Proves
 * the decode + canvas-render path works without any phone connected.
 */
export function runDecoderSelfTest(
  canvas: HTMLCanvasElement,
  onStats?: (fps: number) => void,
  onError?: (msg: string) => void
): DemoHandle {
  const decoder = new BeamDecoder(canvas)
  if (onStats) decoder.setOnStats(onStats)
  if (onError) decoder.setOnError(onError)
  decoder.start({ width: W, height: H, fps: FPS, codec: CODEC })

  const src = document.createElement('canvas')
  src.width = W
  src.height = H
  const sctx = src.getContext('2d')!

  const encoder = new VideoEncoder({
    output: (chunk) => {
      const buf = new Uint8Array(chunk.byteLength)
      chunk.copyTo(buf)
      const flags = chunk.type === 'key' ? FrameFlags.KEYFRAME : 0
      decoder.push(flags, buf)
    },
    error: (e) => onError?.(`encoder: ${e.message}`)
  })
  encoder.configure({
    codec: CODEC,
    width: W,
    height: H,
    bitrate: 4_000_000,
    framerate: FPS,
    avc: { format: 'annexb' },
    latencyMode: 'realtime'
  })

  let frameCount = 0
  let running = true
  let raf = 0
  const t0 = performance.now()

  const tick = (): void => {
    if (!running) return
    const t = (performance.now() - t0) / 1000
    drawScene(sctx, t, frameCount)
    const frame = new VideoFrame(src, { timestamp: Math.round((frameCount * 1_000_000) / FPS) })
    encoder.encode(frame, { keyFrame: frameCount % (FPS * 2) === 0 })
    frame.close()
    frameCount++
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    stop() {
      running = false
      cancelAnimationFrame(raf)
      try {
        encoder.close()
      } catch {
        /* already closed */
      }
      decoder.stop()
    }
  }
}

function drawScene(ctx: CanvasRenderingContext2D, t: number, frame: number): void {
  // Background
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, W, H)

  // Moving brand-gradient blob
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, palette.accent)
  grad.addColorStop(1, palette.teal)
  ctx.fillStyle = grad
  const cx = W / 2 + Math.cos(t * 1.1) * (W * 0.28)
  const cy = H / 2 + Math.sin(t * 0.9) * (H * 0.3)
  ctx.beginPath()
  ctx.arc(cx, cy, 140, 0, Math.PI * 2)
  ctx.fill()

  // Header
  ctx.fillStyle = palette.text
  ctx.font = '900 64px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('BEAM', W / 2, 160)

  ctx.fillStyle = palette.textMuted
  ctx.font = '700 28px system-ui, sans-serif'
  ctx.fillText('Decoder test', W / 2, 210)

  // Live counters prove frames are genuinely flowing
  ctx.fillStyle = palette.accent
  ctx.font = '800 40px "Cascadia Code", Consolas, monospace'
  ctx.fillText(`${t.toFixed(1)} s`, W / 2, H - 220)
  ctx.fillStyle = palette.teal
  ctx.fillText(`frame ${frame}`, W / 2, H - 160)
}
