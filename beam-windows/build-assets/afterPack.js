// electron-builder afterPack hook: embed the Beam icon into Beam.exe.
//
// We set win.signAndEditExecutable=false so the build doesn't need electron-builder's
// winCodeSign tool (which can't extract its macOS symlinks on a non-Developer-Mode
// Windows shell). The trade-off is electron-builder no longer sets the exe icon, so we
// do it here with a standalone rcedit (downloaded once, cached in build-assets/).
const { execFileSync } = require('node:child_process')
const { existsSync, createWriteStream } = require('node:fs')
const { join } = require('node:path')
const https = require('node:https')

const RCEDIT_URL =
  'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const go = (u) =>
      https
        .get(u, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            go(res.headers.location)
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error('rcedit download HTTP ' + res.statusCode))
            return
          }
          res.pipe(file)
          file.on('finish', () => file.close(() => resolve()))
        })
        .on('error', reject)
    go(url)
  })
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const projectDir = context.packager.info.projectDir
  const exe = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const ico = join(projectDir, 'build-assets', 'icon.ico')
  const rcedit = join(projectDir, 'build-assets', 'rcedit-x64.exe')
  if (!existsSync(rcedit)) await download(RCEDIT_URL, rcedit)
  execFileSync(rcedit, [exe, '--set-icon', ico], { stdio: 'inherit' })
  console.log('afterPack: embedded icon into', exe)
}
