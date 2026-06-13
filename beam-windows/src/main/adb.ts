import { execFile } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import { app } from 'electron'

const execFileP = promisify(execFile)

const PKG = 'life.overture.beam'
const APK_VERSION = 'v0.1.0'
const APK_URL = `https://github.com/LioMatthys/Beam/releases/download/${APK_VERSION}/Beam.apk`
const APK_NAME = `Beam-${APK_VERSION}.apk`

/** Find adb: ANDROID_HOME, the default SDK location, then PATH. */
export function resolveAdb(): string {
  const candidates: string[] = []
  if (process.env.ANDROID_HOME) {
    candidates.push(join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'))
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe'))
  }
  for (const p of candidates) if (existsSync(p)) return p
  return process.platform === 'win32' ? 'adb.exe' : 'adb'
}

export type DeviceState = 'none' | 'unauthorized' | 'ready'
export interface DeviceInfo {
  state: DeviceState
  serial?: string
  model?: string
}

export interface InstallProgress {
  phase: 'detecting' | 'downloading' | 'installing' | 'launching' | 'done'
  message: string
  percent?: number
}

export async function detectDevice(): Promise<DeviceInfo> {
  try {
    const { stdout } = await execFileP(resolveAdb(), ['devices', '-l'], { windowsHide: true })
    const lines = stdout
      .split(/\r?\n/)
      .slice(1) // drop the "List of devices attached" header
      .map((l) => l.trim())
      .filter(Boolean)

    for (const line of lines) {
      const parts = line.split(/\s+/)
      const serial = parts[0]
      const st = parts[1]
      if (st === 'unauthorized') return { state: 'unauthorized', serial }
      if (st === 'device') {
        const modelTok = parts.find((p) => p.startsWith('model:'))
        const model = modelTok ? modelTok.slice('model:'.length).replace(/_/g, ' ') : undefined
        return { state: 'ready', serial, model }
      }
    }
    return { state: 'none' }
  } catch {
    // adb missing or not runnable
    return { state: 'none' }
  }
}

async function downloadApk(onProgress: (p: InstallProgress) => void): Promise<string> {
  const dir = join(app.getPath('userData'), 'apk')
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, APK_NAME)
  if (existsSync(dest) && statSync(dest).size > 1_000_000) return dest // already cached

  onProgress({ phase: 'downloading', message: 'Downloading app…', percent: 0 })
  const res = await fetch(APK_URL)
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status}). Is the release published?`)

  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  const fileStream = createWriteStream(dest)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeStream = Readable.fromWeb(res.body as any)
  nodeStream.on('data', (chunk: Buffer) => {
    received += chunk.length
    if (total) {
      onProgress({
        phase: 'downloading',
        message: 'Downloading app…',
        percent: Math.round((received / total) * 100)
      })
    }
  })
  await new Promise<void>((resolve, reject) => {
    nodeStream.pipe(fileStream)
    fileStream.on('finish', () => resolve())
    fileStream.on('error', reject)
    nodeStream.on('error', reject)
  })
  return dest
}

/** Detect → download → `adb install -r -g` → launch. Throws with a user-facing message. */
export async function installAndLaunch(onProgress: (p: InstallProgress) => void): Promise<DeviceInfo> {
  const adb = resolveAdb()

  onProgress({ phase: 'detecting', message: 'Looking for a USB device…' })
  const dev = await detectDevice()
  if (dev.state === 'none') {
    throw new Error('No device found. Connect the phone by USB and enable USB debugging.')
  }
  if (dev.state === 'unauthorized') {
    throw new Error('Phone not authorized. Unlock it and tap “Allow” on the USB-debugging prompt.')
  }

  const apk = await downloadApk(onProgress)

  onProgress({ phase: 'installing', message: 'Installing on the phone…' })
  const { stdout, stderr } = await execFileP(
    adb,
    ['-s', dev.serial!, 'install', '-r', '-g', apk],
    { maxBuffer: 16 * 1024 * 1024, windowsHide: true }
  )
  if (/Failure|Error/i.test(stdout + stderr)) {
    throw new Error(`Install failed: ${(stdout + stderr).trim().split(/\r?\n/).pop()}`)
  }

  onProgress({ phase: 'launching', message: 'Launching Beam…' })
  try {
    await execFileP(adb, [
      '-s',
      dev.serial!,
      'shell',
      'monkey',
      '-p',
      PKG,
      '-c',
      'android.intent.category.LAUNCHER',
      '1'
    ], { windowsHide: true })
  } catch {
    // launch is best-effort; the app is installed regardless
  }

  onProgress({ phase: 'done', message: `Installed on ${dev.model ?? 'your phone'} — tap “Start sharing”.` })
  return dev
}
