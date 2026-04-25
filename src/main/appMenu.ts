import { app, BrowserWindow, Menu } from 'electron'
import type { Database } from 'better-sqlite3'
import { getAppSettings } from './data/settingsService'

/**
 * File / Edit / View–style template for support and debugging.
 * The app also calls this when the user turns the option on in Settings.
 */
function buildClassicMenuTemplate() {
  const t: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ]
  if (process.platform === 'darwin') {
    t.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }
  return t
}

/** When classic menu is off, macOS still needs a small app menu (default POS hides extra chrome only on win/linux with null). */
function buildMinimalMacMenu() {
  return Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ])
}

/**
 * Read settings and set the global `Menu` + per-window menu bar (Windows / Linux only).
 * Safe to call after a setting change (e.g. from IPC).
 */
export function applyApplicationMenu(db: Database): void {
  const g = getAppSettings(db)
  if (!g.ok) {
    return
  }
  const show = g.data.showClassicMenu
  if (show) {
    const menu = Menu.buildFromTemplate(buildClassicMenuTemplate())
    Menu.setApplicationMenu(menu)
  } else {
    if (process.platform === 'darwin') {
      Menu.setApplicationMenu(buildMinimalMacMenu())
    } else {
      Menu.setApplicationMenu(null)
    }
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (process.platform === 'linux' || process.platform === 'win32') {
      win.setAutoHideMenuBar(!show)
      win.setMenuBarVisibility(show)
    }
  }
}

/**
 * `BrowserWindow` options: hide the menu bar until user presses Alt when the classic menu is off (Windows / Linux).
 */
export function getAutoHideMenuBarForNewWindow(db: Database): boolean {
  const g = getAppSettings(db)
  if (!g.ok) {
    return true
  }
  return !g.data.showClassicMenu
}
