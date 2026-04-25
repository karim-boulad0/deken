import { app, ipcMain } from 'electron'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../data/categoryService'
import {
  createCategoryFlavor,
  createCategorySize,
  deleteCategoryFlavor,
  deleteCategorySize,
  listCategoryFlavors,
  listCategorySizes,
  updateCategoryFlavor,
  updateCategorySize,
} from '../data/productAttributeService'
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
import { getAuthSession, login, logout, requireModulePermission } from '../data/authService'
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserCredentials,
  setUserPermissions,
  updateUser,
} from '../data/userService'
import { getDatabase } from '../db/connection'
import { IpcInvokes } from '../../shared/ipc/types'
import type {
  AuthLoginInput,
  CreateCategoryInput,
  CreateCategoryFlavorInput,
  CreateCategorySizeInput,
  CreateCustomerInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateProductInput,
  CreateSupplierInput,
  CreateSupplierInvoiceInput,
  CreateSupplierPaymentInput,
  CompleteDebtSaleInput,
  DashboardSnapshotInput,
  CreateUserInput,
  IpcResult,
  ListExpensesInRangeInput,
  ListRecentCashflowInput,
  PosSaleLineInput,
  AuthSessionDto,
  RecordDebtPaymentInput,
  SalesReportInput,
  UpdateAppSettingsInput,
  UpdateCategoryInput,
  UpdateCategoryFlavorInput,
  UpdateCategorySizeInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateProductInput,
  UpdateSupplierInput,
  UpdateUserInput,
  VerifyActivationInput,
  SetUserPermissionsInput,
  ResetUserCredentialsInput,
  PermissionModule,
} from '../../shared/ipc/types'

/**
 * Wires all IPC invokers to main-process services. Renderer never runs SQL.
 */
export function registerIpc(): void {
  const db = () => getDatabase()
  const guard = (moduleKey: PermissionModule): IpcResult<null> => {
    const r = requireModulePermission(db(), moduleKey)
    if (!r.ok) {
      return r
    }
    return { ok: true, data: null }
  }
  const guardSession = (moduleKey: PermissionModule): IpcResult<AuthSessionDto> => {
    return requireModulePermission(db(), moduleKey)
  }

  ipcMain.handle(IpcInvokes.getAppVersion, (): IpcResult<string> => {
    return { ok: true, data: app.getVersion() }
  })

  ipcMain.handle(IpcInvokes.authGetSession, () => {
    return getAuthSession(db())
  })

  ipcMain.handle(IpcInvokes.authLogin, (_evt, input: AuthLoginInput) => {
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return login(db(), input)
  })

  ipcMain.handle(IpcInvokes.authLogout, () => {
    return logout(db())
  })

  ipcMain.handle(IpcInvokes.usersList, () => {
    const g = guard('employees')
    if (!g.ok) return g
    return listUsers(db())
  })

  ipcMain.handle(IpcInvokes.usersCreate, (_evt, input: CreateUserInput) => {
    const g = guard('employees')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createUser(db(), input)
  })

  ipcMain.handle(IpcInvokes.usersUpdate, (_evt, id: string, input: UpdateUserInput) => {
    const g = guard('employees')
    if (!g.ok) return g
    if (typeof id !== 'string' || input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return updateUser(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.usersSetPermissions, (_evt, id: string, input: SetUserPermissionsInput) => {
    const g = guard('employees')
    if (!g.ok) return g
    if (typeof id !== 'string' || input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return setUserPermissions(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.usersResetCredentials, (_evt, id: string, input: ResetUserCredentialsInput) => {
    const g = guard('employees')
    if (!g.ok) return g
    if (typeof id !== 'string' || input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return resetUserCredentials(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.usersDelete, (_evt, id: string) => {
    const g = guard('employees')
    if (!g.ok) return g
    if (typeof id !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return deleteUser(db(), id)
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
      const g = guard('products')
      if (!g.ok) return g
      return listProducts(db(), q ?? '', filterCategoryId ?? null)
    },
  )

  ipcMain.handle(IpcInvokes.createProduct, (_evt, input: CreateProductInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return createProduct(db(), input)
  })

  ipcMain.handle(IpcInvokes.updateProduct, (_evt, id: string, input: UpdateProductInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return updateProduct(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteProduct, (_evt, id: string) => {
    const g = guard('products')
    if (!g.ok) return g
    return deleteProduct(db(), id)
  })

  ipcMain.handle(IpcInvokes.findProductByCode, (_evt, code: string) => {
    const g = guard('pos')
    if (!g.ok) return g
    return findProductByCode(db(), code ?? '')
  })

  ipcMain.handle(IpcInvokes.listCategories, () => {
    const g = guard('products')
    if (!g.ok) return g
    return listCategories(db())
  })

  ipcMain.handle(IpcInvokes.createCategory, (_evt, input: CreateCategoryInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return createCategory(db(), input)
  })

  ipcMain.handle(IpcInvokes.updateCategory, (_evt, id: string, input: UpdateCategoryInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return updateCategory(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteCategory, (_evt, id: string) => {
    const g = guard('products')
    if (!g.ok) return g
    return deleteCategory(db(), id)
  })

  ipcMain.handle(IpcInvokes.listCategorySizes, () => {
    const g = guard('products')
    if (!g.ok) return g
    return listCategorySizes(db())
  })
  ipcMain.handle(IpcInvokes.createCategorySize, (_evt, input: CreateCategorySizeInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return createCategorySize(db(), input)
  })
  ipcMain.handle(IpcInvokes.updateCategorySize, (_evt, id: string, input: UpdateCategorySizeInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return updateCategorySize(db(), id, input)
  })
  ipcMain.handle(IpcInvokes.deleteCategorySize, (_evt, id: string) => {
    const g = guard('products')
    if (!g.ok) return g
    return deleteCategorySize(db(), id)
  })

  ipcMain.handle(IpcInvokes.listCategoryFlavors, () => {
    const g = guard('products')
    if (!g.ok) return g
    return listCategoryFlavors(db())
  })
  ipcMain.handle(IpcInvokes.createCategoryFlavor, (_evt, input: CreateCategoryFlavorInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return createCategoryFlavor(db(), input)
  })
  ipcMain.handle(IpcInvokes.updateCategoryFlavor, (_evt, id: string, input: UpdateCategoryFlavorInput) => {
    const g = guard('products')
    if (!g.ok) return g
    return updateCategoryFlavor(db(), id, input)
  })
  ipcMain.handle(IpcInvokes.deleteCategoryFlavor, (_evt, id: string) => {
    const g = guard('products')
    if (!g.ok) return g
    return deleteCategoryFlavor(db(), id)
  })

  ipcMain.handle(IpcInvokes.completeCashSale, (_evt, lines: PosSaleLineInput[]) => {
    const g = guardSession('pos')
    if (!g.ok) return g
    return completeCashSale(db(), Array.isArray(lines) ? lines : [], g.data.user.id)
  })

  ipcMain.handle(IpcInvokes.listCustomers, () => {
    const g = guard('debts')
    if (!g.ok) return g
    return listCustomers(db())
  })

  ipcMain.handle(IpcInvokes.listCustomerBalances, () => {
    const g = guard('debts')
    if (!g.ok) return g
    return listCustomerBalances(db())
  })

  ipcMain.handle(IpcInvokes.getCustomerLedger, (_evt, customerId: string) => {
    const g = guard('debts')
    if (!g.ok) return g
    return getCustomerLedger(db(), typeof customerId === 'string' ? customerId : '')
  })

  ipcMain.handle(IpcInvokes.recordDebtPayment, (_evt, input: RecordDebtPaymentInput) => {
    const g = guardSession('debts')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object' || typeof input.customerId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return recordDebtPayment(db(), input, g.data.user.id)
  })

  ipcMain.handle(IpcInvokes.createCustomer, (_evt, input: CreateCustomerInput) => {
    const g = guardSession('debts')
    if (!g.ok) return g
    return createCustomer(db(), input, g.data.user.id)
  })

  ipcMain.handle(IpcInvokes.completeDebtSale, (_evt, input: CompleteDebtSaleInput) => {
    const g = guardSession('debts')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object' || !Array.isArray((input as CompleteDebtSaleInput).lines)) {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return completeDebtSale(db(), input, g.data.user.id)
  })

  ipcMain.handle(
    IpcInvokes.getDebtSaleLines,
    (_evt, customerId: string, saleId: string) => {
      const g = guard('debts')
      if (!g.ok) return g
      if (typeof customerId !== 'string' || typeof saleId !== 'string') {
        return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
      }
      return getDebtSaleLines(db(), customerId, saleId)
    },
  )

  ipcMain.handle(IpcInvokes.getSalesReport, (_evt, r: SalesReportInput) => {
    const g = guard('reports')
    if (!g.ok) return g
    if (r == null || typeof r !== 'object' || typeof r.fromDate !== 'string' || typeof r.toDate !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return getSalesReport(db(), r.fromDate, r.toDate)
  })

  ipcMain.handle(IpcInvokes.getAppSettings, () => {
    const g = guard('settings')
    if (!g.ok) return g
    return getAppSettings(db())
  })

  ipcMain.handle(IpcInvokes.setAppSettings, (_evt, input: UpdateAppSettingsInput) => {
    const g = guard('settings')
    if (!g.ok) return g
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
    const g = guard('dashboard')
    if (!g.ok) return g
    if (
      input != null &&
      (typeof input !== 'object' || !['today', '7d', '30d'].includes(String(input.range)))
    ) {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return getDashboardSnapshot(db(), input ?? { range: 'today' })
  })

  ipcMain.handle(IpcInvokes.listSupplierBalances, () => {
    const g = guard('suppliers')
    if (!g.ok) return g
    return listSupplierBalances(db())
  })

  ipcMain.handle(IpcInvokes.createSupplier, (_evt, input: CreateSupplierInput) => {
    const g = guard('suppliers')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createSupplier(db(), input)
  })

  ipcMain.handle(IpcInvokes.updateSupplier, (_evt, id: string, input: UpdateSupplierInput) => {
    const g = guard('suppliers')
    if (!g.ok) return g
    if (typeof id !== 'string' || input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return updateSupplier(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteSupplier, (_evt, id: string) => {
    const g = guard('suppliers')
    if (!g.ok) return g
    if (typeof id !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return deleteSupplier(db(), id)
  })

  ipcMain.handle(IpcInvokes.listSupplierInvoices, (_evt, supplierId: string) => {
    const g = guard('suppliers')
    if (!g.ok) return g
    if (typeof supplierId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return listSupplierInvoices(db(), supplierId)
  })

  ipcMain.handle(IpcInvokes.listSupplierPayments, (_evt, supplierId: string) => {
    const g = guard('suppliers')
    if (!g.ok) return g
    if (typeof supplierId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return listSupplierPayments(db(), supplierId)
  })

  ipcMain.handle(IpcInvokes.createSupplierInvoice, (_evt, input: CreateSupplierInvoiceInput) => {
    const g = guardSession('suppliers')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createSupplierInvoice(db(), input, g.data.user.id)
  })

  ipcMain.handle(IpcInvokes.createSupplierPayment, (_evt, input: CreateSupplierPaymentInput) => {
    const g = guardSession('suppliers')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createSupplierPayment(db(), input, g.data.user.id)
  })

  ipcMain.handle(IpcInvokes.listExpenseCategories, () => {
    const g = guard('expenses')
    if (!g.ok) return g
    return listExpenseCategories(db())
  })

  ipcMain.handle(IpcInvokes.createExpenseCategory, (_evt, input: CreateExpenseCategoryInput) => {
    const g = guard('expenses')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createExpenseCategory(db(), input)
  })

  ipcMain.handle(
    IpcInvokes.updateExpenseCategory,
    (_evt, id: string, input: UpdateExpenseCategoryInput) => {
      const g = guard('expenses')
      if (!g.ok) return g
      if (typeof id !== 'string' || input == null || typeof input !== 'object') {
        return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
      }
      return updateExpenseCategory(db(), id, input)
    },
  )

  ipcMain.handle(IpcInvokes.deleteExpenseCategory, (_evt, id: string) => {
    const g = guard('expenses')
    if (!g.ok) return g
    if (typeof id !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return deleteExpenseCategory(db(), id)
  })

  ipcMain.handle(IpcInvokes.listExpensesInRange, (_evt, input: ListExpensesInRangeInput) => {
    const g = guard('expenses')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return listExpensesInRange(db(), input)
  })

  ipcMain.handle(IpcInvokes.getExpenseTotalInRange, (_evt, input: ListExpensesInRangeInput) => {
    const g = guard('expenses')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return getExpenseTotalInRange(db(), input)
  })

  ipcMain.handle(IpcInvokes.createExpense, (_evt, input: CreateExpenseInput) => {
    const g = guardSession('expenses')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return createExpense(db(), input, g.data.user.id)
  })

  ipcMain.handle(IpcInvokes.updateExpense, (_evt, id: string, input: UpdateExpenseInput) => {
    const g = guard('expenses')
    if (!g.ok) return g
    if (typeof id !== 'string' || input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return updateExpense(db(), id, input)
  })

  ipcMain.handle(IpcInvokes.deleteExpense, (_evt, id: string) => {
    const g = guard('expenses')
    if (!g.ok) return g
    if (typeof id !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return deleteExpense(db(), id)
  })

  ipcMain.handle(IpcInvokes.listRecentCashflow, (_evt, input: ListRecentCashflowInput) => {
    const g = guard('cashflow')
    if (!g.ok) return g
    if (input == null || typeof input !== 'object') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    const lim = Number((input as ListRecentCashflowInput).limit)
    return listRecentCashflow(db(), { limit: lim })
  })

  ipcMain.handle(IpcInvokes.voidCashSale, (_evt, saleId: string) => {
    const g = guard('cashflow')
    if (!g.ok) return g
    if (typeof saleId !== 'string') {
      return { ok: false, error: { code: 'validation', message: 'invalid_input' } }
    }
    return voidCashSale(db(), saleId)
  })
}
