/**
 * Captures the MessagePort transferred from the main process (via preload).
 *
 * The listener is registered at module-evaluation time — before the page's
 * `load` event, and therefore before the main process posts the port on
 * `did-finish-load` — so there is no race and the port is never missed.
 */
let port: MessagePort | null = null
const subs = new Set<(p: MessagePort) => void>()

window.addEventListener('message', (e: MessageEvent) => {
  if (e.data === 'beam:port' && e.ports[0]) {
    port = e.ports[0]
    subs.forEach((cb) => cb(port!))
  }
})

export function onFramePort(cb: (p: MessagePort) => void): () => void {
  if (port) cb(port)
  else subs.add(cb)
  return () => subs.delete(cb)
}
