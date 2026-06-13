const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 700,
    webPreferences: { nodeIntegration: true, contextIsolation: false, offscreen: false }
  })

  let done = false
  win.webContents.on('console-message', (_e, _lvl, message) => {
    if (typeof message === 'string' && message.includes('ICONS_DONE')) {
      done = true
      console.log('RENDERED')
      win.destroy()
      app.exit(0)
    } else {
      console.log('[r] ' + message)
    }
  })

  win.loadFile(path.join(__dirname, 'index.html'))
  setTimeout(() => {
    if (!done) {
      console.log('TIMEOUT')
      app.exit(2)
    }
  }, 20000)
})
