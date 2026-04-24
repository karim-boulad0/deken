import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('deken', {
  appVersion: '0.0.1',
})
