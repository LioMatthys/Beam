import { HEADER_SIZE } from '../shared/protocol'
import type { BeamFrame } from '../shared/protocol'

/**
 * Reassembles length-prefixed Beam frames from the multiplexed TCP byte stream.
 *
 * Wire layout per frame: [uint32 BE length][uint8 channel][uint8 type][payload].
 * Feed raw chunks via `push()`; it returns any frames that became complete.
 */
export class FrameParser {
  private buffer: Buffer = Buffer.alloc(0)

  push(chunk: Buffer): BeamFrame[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk])
    const frames: BeamFrame[] = []

    while (this.buffer.length >= HEADER_SIZE) {
      const length = this.buffer.readUInt32BE(0)
      const total = HEADER_SIZE + length
      if (this.buffer.length < total) break // wait for the rest of the payload

      const channel = this.buffer.readUInt8(4)
      const type = this.buffer.readUInt8(5)
      const data = new Uint8Array(length)
      this.buffer.copy(data, 0, HEADER_SIZE, total)
      frames.push({ channel, type, data })

      this.buffer = this.buffer.subarray(total)
    }

    return frames
  }

  reset(): void {
    this.buffer = Buffer.alloc(0)
  }
}
