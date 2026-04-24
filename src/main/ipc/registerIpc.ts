import { app, ipcMain } from 'electron'
import {
  createProduct,
  deleteProduct,
  findProductByCode,
  listProducts,
  updateProduct,
} from '../data/productService'
import { getDatabase } from '../db/connection'
import { IpcInvokes } from '../../shared/ipc/types'
import type { CreateProductInput, IpcResult, UpdateProductInput } from '../../shared/ipc/types'

/**
 * Wires all IPC invokers to main-process services. Renderer never runs SQL.
 */
export function registerIpc(): void {
  const db = () => getDatabase()

  ipcMain.handle(IpcInvokes.getAppVersion, (): IpcResult<string> => {
    return { ok: true, data: app.getVersion() }
  })

  ipcMain.handle(IpcInvokes.listProducts, (_evt, q: string) => {
    return listProducts(db(), q ?? '')
  })

  ipcMain.handle(IpcInvokes.createProduct, (_evt, input: CreateProductInput) => {
    return createProduct(db(), input)
  })

  ipcMain.handle(IpcInvokes.updateProduct, (_evt, id: string, input: UpdateProductInput) => {
    return updateProduct(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteProduct, (_evt, id: string) => {
    return deleteProduct(db(), id)
  })

  ipcMain.handle(IpcInvokes.findProductByCode, (_evt, code: string) => {
    return findProductByCode(db(), code ?? '')
  })
}
