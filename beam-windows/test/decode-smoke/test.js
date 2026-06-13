// Headless WebCodecs smoke test: encode 30 frames to Annex-B H.264, decode them
// back, count decoded frames. Mirrors the real Beam decode path (Annex-B, no
// `description`). Prints SMOKE_RESULT:<json> which the Electron harness reads.
const W = 320
const H = 240
const FPS = 30
const CODEC = 'avc1.42E01F'

let decoded = 0
let encoded = 0
let err = null

const src = document.createElement('canvas')
src.width = W
src.height = H
const sctx = src.getContext('2d')

const dec = new VideoDecoder({
  output: (f) => {
    decoded++
    f.close()
  },
  error: (e) => {
    err = 'decoder: ' + e.message
  }
})
dec.configure({ codec: CODEC, optimizeForLatency: true })

const enc = new VideoEncoder({
  output: (chunk) => {
    const b = new Uint8Array(chunk.byteLength)
    chunk.copyTo(b)
    encoded++
    try {
      dec.decode(new EncodedVideoChunk({ type: chunk.type, timestamp: chunk.timestamp, data: b }))
    } catch (e) {
      err = 'decode-call: ' + e.message
    }
  },
  error: (e) => {
    err = 'encoder: ' + e.message
  }
})
enc.configure({
  codec: CODEC,
  width: W,
  height: H,
  bitrate: 1_000_000,
  framerate: FPS,
  avc: { format: 'annexb' },
  latencyMode: 'realtime'
})

async function run() {
  for (let i = 0; i < 30; i++) {
    sctx.fillStyle = `hsl(${i * 12}, 80%, 50%)`
    sctx.fillRect(0, 0, W, H)
    const vf = new VideoFrame(src, { timestamp: Math.round((i * 1_000_000) / FPS) })
    enc.encode(vf, { keyFrame: i % 15 === 0 })
    vf.close()
  }
  await enc.flush()
  await dec.flush()
  console.log('SMOKE_RESULT:' + JSON.stringify({ encoded, decoded, err }))
}

run().catch((e) => {
  console.log('SMOKE_RESULT:' + JSON.stringify({ encoded, decoded, err: String(e) }))
})
