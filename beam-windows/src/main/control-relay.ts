import net from 'node:net'
import type { ControlRequest, ControlResponse } from '../shared/protocol'

type SendToPhone = (req: ControlRequest) => boolean

/**
 * Localhost bridge between DroidPilot and the phone's CONTROL channel.
 *
 * DroidPilot connects to 127.0.0.1:<port> and speaks newline-delimited control
 * JSON (`{"id","op","args"}` → `{"id","ok","result"}`). The relay forwards each
 * request to the phone over the live Beam socket (as a channel-1 frame) and pipes
 * the phone's response back to DroidPilot, matched by id. Pure plumbing — no agent
 * logic, no model, no key here.
 */
export class ControlRelay {
  private server: net.Server | null = null
  private client: net.Socket | null = null
  private buf = ''
  private pending = new Set<number>()

  constructor(
    private readonly sendToPhone: SendToPhone,
    private readonly port = 8788
  ) {}

  start(): void {
    if (this.server) return
    this.server = net.createServer((socket) => this.onClient(socket))
    this.server.on('error', () => {
      /* port in use / transient — relay just stays down */
    })
    this.server.listen(this.port, '127.0.0.1')
  }

  private onClient(socket: net.Socket): void {
    this.client?.destroy() // single client (DroidPilot) at a time
    this.client = socket
    this.buf = ''
    this.pending.clear()
    socket.setNoDelay(true)
    socket.on('data', (chunk) => this.onClientData(chunk))
    socket.on('close', () => {
      if (this.client === socket) this.client = null
    })
    socket.on('error', () => {})
  }

  private onClientData(chunk: Buffer): void {
    this.buf += chunk.toString('utf8')
    let nl: number
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).trim()
      this.buf = this.buf.slice(nl + 1)
      if (!line) continue
      let req: ControlRequest
      try {
        req = JSON.parse(line)
      } catch {
        continue
      }
      if (this.sendToPhone(req)) {
        this.pending.add(req.id)
      } else {
        this.reply({ id: req.id, ok: false, error: 'No phone connected to Beam.' })
      }
    }
  }

  /** Called when the phone sends a CONTROL response (matched by id). */
  deliverFromPhone(resp: ControlResponse): void {
    if (!this.pending.has(resp.id)) return // not a relayed request (e.g. click-to-act)
    this.pending.delete(resp.id)
    this.reply(resp)
  }

  private reply(resp: ControlResponse): void {
    this.client?.write(JSON.stringify(resp) + '\n')
  }

  stop(): void {
    this.client?.destroy()
    this.server?.close()
    this.server = null
    this.client = null
  }
}
