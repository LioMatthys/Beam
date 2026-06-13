// Electron harness for the WebCodecs smoke test. Loads index.html in a hidden
// window, watches the console for SMOKE_RESULT, prints it, and exits 0/1.
const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 400,
    webPreferences: { offscreen: false }
  })

  let done = false
  win.webContents.on('console-message', (_event, _level, message) => {
    if (typeof message === 'string' && message.startsWith('SMOKE_RESULT:')) {
      done = true
      const json = message.slice('SMOKE_RESULT:'.length)
      console.log('RESULT ' + json)
      let ok = false
      try {
        const r = JSON.parse(json)
        ok = !r.err && r.decoded > 0
      } catch {
        ok = false
      }
      win.destroy()
      app.exit(ok ? 0 : 1)
    } else {
      console.log('[renderer] ' + message)
    }
  })

  win.loadFile(path.join(__dirname, 'index.html'))

  setTimeout(() => {
    if (!done) {
      console.log('TIMEOUT — no SMOKE_RESULT received')
      app.exit(2)
    }
  }, 20000)
})
