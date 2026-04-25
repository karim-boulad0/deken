import { app, BrowserWindow, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { applyApplicationMenu, getAutoHideMenuBarForNewWindow } from './appMenu'
import { closeDatabase, getDatabase } from './db/connection'
import { registerIpc } from './ipc/registerIpc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_NAME = 'Business Suite'

function createWindow(): void {
  const autoHideMenuBar = getAutoHideMenuBarForNewWindow(getDatabase())
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: true,
    autoHideMenuBar,
    backgroundColor: '#eef1f7',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void win.loadURL(rendererUrl)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    getDatabase()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    void dialog.showErrorBox(APP_NAME, msg)
    app.exit(1)
    return
  }

  registerIpc()
  applyApplicationMenu(getDatabase())
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
