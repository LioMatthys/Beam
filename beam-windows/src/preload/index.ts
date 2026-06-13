import { contextBridge, ipcRenderer } from 'electron'
import type { BeamApi } from '../shared/api'
import type { ConnectOptions, ConnectionStatus } from '../shared/protocol'

const api: BeamApi = {
  connect: (opts: ConnectOptions) => ipcRenderer.invoke('beam:connect', opts),
  disconnect: () => ipcRenderer.invoke('beam:disconnect'),
  onStatus: (cb: (status: ConnectionStatus) => void) => {
    const listener = (_e: unknown, status: ConnectionStatus): void => cb(status)
    ipcRenderer.on('beam:status', listener)
    return () => ipcRenderer.removeListener('beam:status', listener)
  }
}

contextBridge.exposeInMainWorld('beam', api)

// The main process transfers a MessagePort (the frame channel) via webContents.postMessage.
// Re-post it into the renderer's window so the decoder can pull frames directly.
ipcRenderer.on('beam:port', (event) => {
  window.postMessage('beam:port', '*', event.ports)
})
