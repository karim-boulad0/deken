import { app, ipcMain } from 'electron'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../data/categoryService'
import { createCustomer, listCustomerBalances, listCustomers } from '../data/customerService'
import { completeCashSale, completeDebtSale } from '../data/saleService'
import {
  createProduct,
  deleteProduct,
  findProductByCode,
  listProducts,
  updateProduct,
} from '../data/productService'
import { getDatabase } from '../db/connection'
import { IpcInvokes } from '../../shared/ipc/types'
import type {
  CreateCategoryInput,
  CreateCustomerInput,
  CreateProductInput,
  CompleteDebtSaleInput,
  IpcResult,
  PosSaleLineInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from '../../shared/ipc/types'

/**
 * Wires all IPC invokers to main-process services. Renderer never runs SQL.
 */
export function registerIpc(): void {
  const db = () => getDatabase()

  ipcMain.handle(IpcInvokes.getAppVersion, (): IpcResult<string> => {
    return { ok: true, data: app.getVersion() }
  })

  ipcMain.handle(
    IpcInvokes.listProducts,
    (_evt, q: string, filterCategoryId: string | null | undefined) => {
      return listProducts(db(), q ?? '', filterCategoryId ?? null)
    },
  )

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

  ipcMain.handle(IpcInvokes.listCategories, () => {
    return listCategories(db())
  })

  ipcMain.handle(IpcInvokes.createCategory, (_evt, input: CreateCategoryInput) => {
    return createCategory(db(), input)
  })

  ipcMain.handle(IpcInvokes.updateCategory, (_evt, id: string, input: UpdateCategoryInput) => {
    return updateCategory(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteCategory, (_evt, id: string) => {
    return deleteCategory(db(), id)
  })

  ipcMain.handle(IpcInvokes.completeCashSale, (_evt, lines: PosSaleLineInput[]) => {
    return completeCashSale(db(), Array.isArray(lines) ? lines : [])
  })

  ipcMain.handle(IpcInvokes.listCustomers, () => {
    return listCustomers(db())
  })

  ipcMain.handle(IpcInvokes.listCustomerBalances, () => {
    return listCustomerBalances(db())
  })

  ipcMain.handle(IpcInvokes.createCustomer, (_evt, input: CreateCustomerInput) => {
    return createCustomer(db(), input)
  })

  ipcMain.handle(IpcInvokes.completeDebtSale, (_evt, input: CompleteDebtSaleInput) => {
    if (input == null || typeof input !== 'object' || !Array.isArray((input as CompleteDebtSaleInput).lines)) {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return completeDebtSale(db(), input)
  })
}
