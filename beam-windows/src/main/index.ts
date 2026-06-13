import { app, shell, BrowserWindow, ipcMain, MessageChannelMain } from 'electron'
import { join } from 'node:path'
import { Connection } from './connection'
import { ControlRelay } from './control-relay'
import { detectDevice, installAndLaunch } from './adb'
import type { MessagePortMain } from 'electron'
import type { ConnectOptions } from '../shared/protocol'

let mainWindow: BrowserWindow | null = null
let framePort: MessagePortMain | null = null
let connection: Connection | null = null
let clickControlId = 1_000_000 // separate id range from DroidPilot's relay requests

// Bridges DroidPilot <-> the phone control channel over 127.0.0.1:8788.
const relay = new ControlRelay((req) => (connection ? connection.sendControl(req) : false))

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#0F0F14',
    icon: join(__dirname, '../../build-assets/icon.png'),
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
        // Channel-0 video frame. MessagePortMain structured-clones to the renderer
        // (it can only *transfer* MessagePortMains, not ArrayBuffers — a copy is fine
        // for H.264 frames). `type` carries the keyframe/config flag bits.
        framePort?.postMessage({ flags: frame.type, data: frame.data })
      },
      (resp) => relay.deliverFromPhone(resp) // channel-1 control responses
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

// Click-to-act: the renderer maps a canvas click to physical phone pixels and
// sends a one-off control op (e.g. tap). Fire-and-forget; the phone's response
// carries an id outside the relay's pending set, so the relay ignores it.
ipcMain.handle('beam:control', (_e, msg: { op: string; args?: Record<string, unknown> }) => {
  const ok = connection?.sendControl({ id: clickControlId++, op: msg.op, args: msg.args }) ?? false
  return { ok }
})

ipcMain.handle('android:detect', () => detectDevice())

ipcMain.handle('android:install', async (e) => {
  try {
    const dev = await installAndLaunch((p) => e.sender.send('android:progress', p))
    return { ok: true, model: dev.model }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

app.whenReady().then(() => {
  relay.start() // 127.0.0.1:8788 for DroidPilot
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  connection?.disconnect()
  relay.stop()
  if (process.platform !== 'darwin') app.quit()
})
