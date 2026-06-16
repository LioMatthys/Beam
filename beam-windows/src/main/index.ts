import { app, shell, BrowserWindow, ipcMain, MessageChannelMain, clipboard } from 'electron'
import { join } from 'node:path'
import { networkInterfaces } from 'node:os'
import { createSocket } from 'node:dgram'
import { execFile } from 'node:child_process'
import { Connection } from './connection'
import { ControlRelay } from './control-relay'
import { detectDevice, installAndLaunch } from './adb'
import type { MessagePortMain } from 'electron'
import type { ConnectOptions, ConnectionStatus } from '../shared/protocol'
import type { NetInfo } from '../shared/api'

/** Fallback scan: prefer real home-LAN ranges over 172.* (often WSL/Hyper-V/Docker). */
function ipFromInterfaces(): string {
  const all: string[] = []
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) all.push(a.address)
    }
  }
  return all.find((ip) => ip.startsWith('192.168.') || ip.startsWith('10.')) ?? all[0] ?? ''
}

/** This PC's LAN IPv4 — the address of the interface that actually routes off-machine
 * (the default route), so we don't pick a WSL/Hyper-V virtual adapter. No packets sent:
 * a UDP `connect` only selects the source interface. */
function localIpv4(): Promise<string> {
  return new Promise((resolve) => {
    const sock = createSocket('udp4')
    const fallback = (): void => {
      try {
        sock.close()
      } catch {
        /* noop */
      }
      resolve(ipFromInterfaces())
    }
    sock.once('error', fallback)
    try {
      sock.connect(53, '8.8.8.8', () => {
        try {
          const addr = sock.address().address
          sock.close()
          resolve(addr && addr !== '0.0.0.0' ? addr : ipFromInterfaces())
        } catch {
          fallback()
        }
      })
    } catch {
      fallback()
    }
  })
}

/** Connected Wi-Fi SSID via `netsh` (empty if not on Wi-Fi or unavailable). */
function wifiSsid(): Promise<string> {
  return new Promise((resolve) => {
    execFile('netsh', ['wlan', 'show', 'interfaces'], { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve('')
      // Match a line "SSID : Name" but not "BSSID".
      const m = stdout.split(/\r?\n/).find((l) => /^\s*SSID\s*:/.test(l))
      resolve(m ? m.split(':').slice(1).join(':').trim() : '')
    })
  })
}

let mainWindow: BrowserWindow | null = null
let framePort: MessagePortMain | null = null
let connection: Connection | null = null
let clickControlId = 1_000_000 // separate id range from DroidPilot's relay requests

// Bridges DroidPilot <-> the phone control channel over 127.0.0.1:8788.
const relay = new ControlRelay((req) => (connection ? connection.sendControl(req) : false))

// Send a status update to the renderer, but only while the window is alive.
// `disconnect()` is called from `window-all-closed`, by which point the window is
// destroyed (not null), so `mainWindow?.` doesn't help — `.send()` would throw
// "Object has been destroyed".
function sendStatus(status: ConnectionStatus): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('beam:status', status)
  }
}

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

  // Once the window is gone, stop writing to its (now destroyed) webContents and
  // MessagePort. Both null-outs make the connection callbacks no-ops during teardown.
  mainWindow.on('closed', () => {
    mainWindow = null
    framePort = null
  })

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
      (status) => sendStatus(status),
      (frame) => {
        // Channel-0 video frame. MessagePortMain structured-clones to the renderer
        // (it can only *transfer* MessagePortMains, not ArrayBuffers — a copy is fine
        // for H.264 frames). `type` carries the keyframe/config flag bits.
        // Guard against a torn-down port (window closing): postMessage on a destroyed
        // port throws synchronously.
        if (!framePort) return
        try {
          framePort.postMessage({ flags: frame.type, data: frame.data })
        } catch {
          framePort = null
        }
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

ipcMain.handle('beam:netinfo', async (): Promise<NetInfo> => {
  return { ip: await localIpv4(), ssid: await wifiSsid() }
})

ipcMain.handle('beam:copy', (_e, text: string) => {
  clipboard.writeText(text)
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
