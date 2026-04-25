import { app, ipcMain } from 'electron'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../data/categoryService'
import {
  createCustomer,
  getCustomerLedger,
  listCustomerBalances,
  listCustomers,
  recordDebtPayment,
} from '../data/customerService'
import {
  completeCashSale,
  completeDebtSale,
  getDebtSaleLines,
  voidCashSale,
} from '../data/saleService'
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  getExpenseTotalInRange,
  listExpenseCategories,
  listExpensesInRange,
  updateExpense,
  updateExpenseCategory,
} from '../data/expenseService'
import { listRecentCashflow } from '../data/cashflowService'
import {
  createSupplier,
  createSupplierInvoice,
  createSupplierPayment,
  deleteSupplier,
  listSupplierBalances,
  listSupplierInvoices,
  listSupplierPayments,
  updateSupplier,
} from '../data/supplierService'
import {
  createProduct,
  deleteProduct,
  findProductByCode,
  listProducts,
  updateProduct,
} from '../data/productService'
import { getSalesReport } from '../data/reportService'
import { getDashboardSnapshot } from '../data/dashboardService'
import { getActivationStatus, verifyActivation } from '../data/activationService'
import { applyApplicationMenu } from '../appMenu'
import { getAppSettings, setAppSettings } from '../data/settingsService'
import { getDatabase } from '../db/connection'
import { IpcInvokes } from '../../shared/ipc/types'
import type {
  CreateCategoryInput,
  CreateCustomerInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateProductInput,
  CreateSupplierInput,
  CreateSupplierInvoiceInput,
  CreateSupplierPaymentInput,
  CompleteDebtSaleInput,
  DashboardSnapshotInput,
  IpcResult,
  ListExpensesInRangeInput,
  ListRecentCashflowInput,
  PosSaleLineInput,
  RecordDebtPaymentInput,
  SalesReportInput,
  UpdateAppSettingsInput,
  UpdateCategoryInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateProductInput,
  UpdateSupplierInput,
  VerifyActivationInput,
} from '../../shared/ipc/types'

/**
 * Wires all IPC invokers to main-process services. Renderer never runs SQL.
 */
export function registerIpc(): void {
  const db = () => getDatabase()

  ipcMain.handle(IpcInvokes.getAppVersion, (): IpcResult<string> => {
    return { ok: true, data: app.getVersion() }
  })

  ipcMain.handle(IpcInvokes.getActivationStatus, () => {
    return getActivationStatus(db())
  })

  ipcMain.handle(IpcInvokes.verifyActivation, (_evt, input: VerifyActivationInput) => {
    return verifyActivation(db(), input)
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

  ipcMain.handle(IpcInvokes.getCustomerLedger, (_evt, customerId: string) => {
    return getCustomerLedger(db(), typeof customerId === 'string' ? customerId : '')
  })

  ipcMain.handle(IpcInvokes.recordDebtPayment, (_evt, input: RecordDebtPaymentInput) => {
    if (input == null || typeof input !== 'object' || typeof input.customerId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return recordDebtPayment(db(), input)
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

  ipcMain.handle(
    IpcInvokes.getDebtSaleLines,
    (_evt, customerId: string, saleId: string) => {
      if (typeof customerId !== 'string' || typeof saleId !== 'string') {
        return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
      }
      return getDebtSaleLines(db(), customerId, saleId)
    },
  )

  ipcMain.handle(IpcInvokes.getSalesReport, (_evt, r: SalesReportInput) => {
    if (r == null || typeof r !== 'object' || typeof r.fromDate !== 'string' || typeof r.toDate !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return getSalesReport(db(), r.fromDate, r.toDate)
  })

  ipcMain.handle(IpcInvokes.getAppSettings, () => {
    return getAppSettings(db())
  })

  ipcMain.handle(IpcInvokes.setAppSettings, (_evt, input: UpdateAppSettingsInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    const r = setAppSettings(db(), input)
    if (r.ok && 'showClassicMenu' in input && input.showClassicMenu !== undefined) {
      applyApplicationMenu(db())
    }
    return r
  })

  ipcMain.handle(IpcInvokes.getDashboardSnapshot, (_evt, input: DashboardSnapshotInput | undefined) => {
    if (
      input != null &&
      (typeof input !== 'object' || !['today', '7d', '30d'].includes(String(input.range)))
    ) {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return getDashboardSnapshot(db(), input ?? { range: 'today' })
  })

  ipcMain.handle(IpcInvokes.listSupplierBalances, () => {
    return listSupplierBalances(db())
  })

  ipcMain.handle(IpcInvokes.createSupplier, (_evt, input: CreateSupplierInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createSupplier(db(), input)
  })

  ipcMain.handle(IpcInvokes.updateSupplier, (_evt, id: string, input: UpdateSupplierInput) => {
    if (typeof id !== 'string' || input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return updateSupplier(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteSupplier, (_evt, id: string) => {
    if (typeof id !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return deleteSupplier(db(), id)
  })

  ipcMain.handle(IpcInvokes.listSupplierInvoices, (_evt, supplierId: string) => {
    if (typeof supplierId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return listSupplierInvoices(db(), supplierId)
  })

  ipcMain.handle(IpcInvokes.listSupplierPayments, (_evt, supplierId: string) => {
    if (typeof supplierId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return listSupplierPayments(db(), supplierId)
  })

  ipcMain.handle(IpcInvokes.createSupplierInvoice, (_evt, input: CreateSupplierInvoiceInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createSupplierInvoice(db(), input)
  })

  ipcMain.handle(IpcInvokes.createSupplierPayment, (_evt, input: CreateSupplierPaymentInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createSupplierPayment(db(), input)
  })

  ipcMain.handle(IpcInvokes.listExpenseCategories, () => {
    return listExpenseCategories(db())
  })

  ipcMain.handle(IpcInvokes.createExpenseCategory, (_evt, input: CreateExpenseCategoryInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createExpenseCategory(db(), input)
  })

  ipcMain.handle(
    IpcInvokes.updateExpenseCategory,
    (_evt, id: string, input: UpdateExpenseCategoryInput) => {
      if (typeof id !== 'string' || input == null || typeof input !== 'object') {
        return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
      }
      return updateExpenseCategory(db(), id, input)
    },
  )

  ipcMain.handle(IpcInvokes.deleteExpenseCategory, (_evt, id: string) => {
    if (typeof id !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return deleteExpenseCategory(db(), id)
  })

  ipcMain.handle(IpcInvokes.listExpensesInRange, (_evt, input: ListExpensesInRangeInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return listExpensesInRange(db(), input)
  })

  ipcMain.handle(IpcInvokes.getExpenseTotalInRange, (_evt, input: ListExpensesInRangeInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return getExpenseTotalInRange(db(), input)
  })

  ipcMain.handle(IpcInvokes.createExpense, (_evt, input: CreateExpenseInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createExpense(db(), input)
  })

  ipcMain.handle(IpcInvokes.updateExpense, (_evt, id: string, input: UpdateExpenseInput) => {
    if (typeof id !== 'string' || input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return updateExpense(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteExpense, (_evt, id: string) => {
    if (typeof id !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return deleteExpense(db(), id)
  })

  ipcMain.handle(IpcInvokes.listRecentCashflow, (_evt, input: ListRecentCashflowInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    const lim = Number((input as ListRecentCashflowInput).limit)
    return listRecentCashflow(db(), { limit: lim })
  })

  ipcMain.handle(IpcInvokes.voidCashSale, (_evt, saleId: string) => {
    if (typeof saleId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return voidCashSale(db(), saleId)
  })
}
