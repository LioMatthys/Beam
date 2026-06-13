import { HEADER_SIZE } from '../shared/protocol'
import type { BeamFrame } from '../shared/protocol'

/**
 * Reassembles length-prefixed Beam frames from a TCP byte stream.
 *
 * Wire layout per frame: [uint32 BE length][uint8 flags][payload length bytes].
 * Feed raw chunks via `push()`; it returns any frames that became complete.
 * Partial frames are buffered until the rest arrives.
 */
export class FrameParser {
  private buffer: Buffer = Buffer.alloc(0)

  /** Append a chunk and drain all complete frames. */
  push(chunk: Buffer): BeamFrame[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk])
    const frames: BeamFrame[] = []

    while (this.buffer.length >= HEADER_SIZE) {
      const length = this.buffer.readUInt32BE(0)
      const total = HEADER_SIZE + length
      if (this.buffer.length < total) break // wait for the rest of the payload

      const flags = this.buffer.readUInt8(4)
      // Copy the payload into its own tightly-sized buffer so it can be transferred
      // to the renderer without dragging the whole accumulation buffer along.
      const data = new Uint8Array(length)
      this.buffer.copy(data, 0, HEADER_SIZE, total)
      frames.push({ flags, data })

      this.buffer = this.buffer.subarray(total)
    }

    return frames
  }

  reset(): void {
    this.buffer = Buffer.alloc(0)
  }
}
