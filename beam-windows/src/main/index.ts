import { app, shell, BrowserWindow, ipcMain, MessageChannelMain } from 'electron'
import { join } from 'node:path'
import { Connection } from './connection'
import type { MessagePortMain } from 'electron'
import type { ConnectOptions } from '../shared/protocol'

let mainWindow: BrowserWindow | null = null
let framePort: MessagePortMain | null = null
let connection: Connection | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#0F0F14',
    title: 'Beam',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Hand the renderer one end of a MessageChannel for high-throughput, zero-copy
  // frame delivery. The main side keeps `framePort` to write decoded H.264 chunks.
  mainWindow.webContents.on('did-finish-load', () => {
    const { port1, port2 } = new MessageChannelMain()
    framePort = port1
    framePort.start()
    mainWindow?.webContents.postMessage('beam:port', null, [port2])
  })

  // electron-vite injects the dev server URL in development; load the built file otherwise.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function ensureConnection(): Connection {
  if (!connection) {
    connection = new Connection(
      (status) => mainWindow?.webContents.send('beam:status', status),
      (frame) => {
        // MessagePortMain structured-clones the payload to the renderer. (It can only
        // *transfer* other MessagePortMains, not ArrayBuffers, so this is a copy — fine
        // for H.264 frames, which are tens of KB.)
        framePort?.postMessage({ flags: frame.flags, data: frame.data })
      }
    )
  }
  return connection
}

ipcMain.handle('beam:connect', (_e, opts: ConnectOptions) => {
  ensureConnection().connect(opts)
})

ipcMain.handle('beam:disconnect', () => {
  connection?.disconnect()
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  connection?.disconnect()
  if (process.platform !== 'darwin') app.quit()
})
