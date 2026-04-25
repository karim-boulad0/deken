import { contextBridge, ipcRenderer } from 'electron'
import { IpcInvokes } from '../shared/ipc/types'
import type {
  AppSettingsDto,
  AuthLoginInput,
  AuthSessionDto,
  ActivationStatusDto,
  CashflowLineDto,
  CategoryDto,
  CategoryFlavorDto,
  CategorySizeDto,
  CompleteCashSaleResult,
  CompleteDebtSaleInput,
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
  CreateUserInput,
  CustomerBalanceRow,
  CustomerDto,
  CustomerLedgerLineDto,
  DashboardSnapshotInput,
  SaleLineViewDto,
  DashboardSnapshotDto,
  ExpenseCategoryDto,
  ExpenseDto,
  ExpenseTotalInRangeDto,
  IpcResult,
  ListExpensesInRangeInput,
  ListRecentCashflowInput,
  PosSaleLineInput,
  ProductDto,
  RecordDebtPaymentInput,
  RecordDebtPaymentResult,
  SalesReportDto,
  SalesReportInput,
  SetUserPermissionsInput,
  SupplierBalanceRow,
  SupplierInvoiceDto,
  SupplierPaymentDto,
  SupplierDto,
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
  ResetUserCredentialsInput,
  UserWithPermissionsDto,
} from '../shared/ipc/types'

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>
}

contextBridge.exposeInMainWorld('deken', {
  getAppVersion: (): Promise<IpcResult<string>> => {
    return invoke(IpcInvokes.getAppVersion)
  },
  auth: {
    getSession: (): Promise<IpcResult<AuthSessionDto | null>> => {
      return invoke(IpcInvokes.authGetSession)
    },
    login: (input: AuthLoginInput): Promise<IpcResult<AuthSessionDto>> => {
      return invoke(IpcInvokes.authLogin, input)
    },
    logout: (): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.authLogout)
    },
  },
  users: {
    list: (): Promise<IpcResult<UserWithPermissionsDto[]>> => {
      return invoke(IpcInvokes.usersList)
    },
    create: (input: CreateUserInput): Promise<IpcResult<UserWithPermissionsDto>> => {
      return invoke(IpcInvokes.usersCreate, input)
    },
    update: (id: string, input: UpdateUserInput): Promise<IpcResult<UserWithPermissionsDto>> => {
      return invoke(IpcInvokes.usersUpdate, id, input)
    },
    setPermissions: (
      id: string,
      input: SetUserPermissionsInput,
    ): Promise<IpcResult<UserWithPermissionsDto>> => {
      return invoke(IpcInvokes.usersSetPermissions, id, input)
    },
    resetCredentials: (
      id: string,
      input: ResetUserCredentialsInput,
    ): Promise<IpcResult<UserWithPermissionsDto>> => {
      return invoke(IpcInvokes.usersResetCredentials, id, input)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.usersDelete, id)
    },
  },
  activation: {
    status: (): Promise<IpcResult<ActivationStatusDto>> => {
      return invoke(IpcInvokes.getActivationStatus)
    },
    verify: (input: VerifyActivationInput): Promise<IpcResult<ActivationStatusDto>> => {
      return invoke(IpcInvokes.verifyActivation, input)
    },
  },
  products: {
    list: (q: string, filterCategoryId?: string | null): Promise<IpcResult<ProductDto[]>> => {
      return invoke(IpcInvokes.listProducts, q, filterCategoryId ?? null)
    },
    create: (input: CreateProductInput): Promise<IpcResult<ProductDto>> => {
      return invoke(IpcInvokes.createProduct, input)
    },
    update: (id: string, input: UpdateProductInput): Promise<IpcResult<ProductDto>> => {
      return invoke(IpcInvokes.updateProduct, id, input)
    },
    findByCode: (code: string): Promise<IpcResult<ProductDto | null>> => {
      return invoke(IpcInvokes.findProductByCode, code)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteProduct, id)
    },
  },
  categories: {
    list: (): Promise<IpcResult<CategoryDto[]>> => {
      return invoke(IpcInvokes.listCategories)
    },
    create: (input: CreateCategoryInput): Promise<IpcResult<CategoryDto>> => {
      return invoke(IpcInvokes.createCategory, input)
    },
    update: (id: string, input: UpdateCategoryInput): Promise<IpcResult<CategoryDto>> => {
      return invoke(IpcInvokes.updateCategory, id, input)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteCategory, id)
    },
  },
  categorySizes: {
    list: (): Promise<IpcResult<CategorySizeDto[]>> => {
      return invoke(IpcInvokes.listCategorySizes)
    },
    create: (input: CreateCategorySizeInput): Promise<IpcResult<CategorySizeDto>> => {
      return invoke(IpcInvokes.createCategorySize, input)
    },
    update: (id: string, input: UpdateCategorySizeInput): Promise<IpcResult<CategorySizeDto>> => {
      return invoke(IpcInvokes.updateCategorySize, id, input)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteCategorySize, id)
    },
  },
  categoryFlavors: {
    list: (): Promise<IpcResult<CategoryFlavorDto[]>> => {
      return invoke(IpcInvokes.listCategoryFlavors)
    },
    create: (input: CreateCategoryFlavorInput): Promise<IpcResult<CategoryFlavorDto>> => {
      return invoke(IpcInvokes.createCategoryFlavor, input)
    },
    update: (id: string, input: UpdateCategoryFlavorInput): Promise<IpcResult<CategoryFlavorDto>> => {
      return invoke(IpcInvokes.updateCategoryFlavor, id, input)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteCategoryFlavor, id)
    },
  },
  customers: {
    list: (): Promise<IpcResult<CustomerDto[]>> => {
      return invoke(IpcInvokes.listCustomers)
    },
    listBalances: (): Promise<IpcResult<CustomerBalanceRow[]>> => {
      return invoke(IpcInvokes.listCustomerBalances)
    },
    getLedger: (customerId: string): Promise<IpcResult<CustomerLedgerLineDto[]>> => {
      return invoke(IpcInvokes.getCustomerLedger, customerId)
    },
    create: (input: CreateCustomerInput): Promise<IpcResult<CustomerDto>> => {
      return invoke(IpcInvokes.createCustomer, input)
    },
  },
  debt: {
    recordPayment: (input: RecordDebtPaymentInput): Promise<IpcResult<RecordDebtPaymentResult>> => {
      return invoke(IpcInvokes.recordDebtPayment, input)
    },
  },
  sales: {
    completeCash: (lines: PosSaleLineInput[]): Promise<IpcResult<CompleteCashSaleResult>> => {
      return invoke(IpcInvokes.completeCashSale, lines)
    },
    completeDebt: (
      input: CompleteDebtSaleInput,
    ): Promise<IpcResult<CompleteCashSaleResult>> => {
      return invoke(IpcInvokes.completeDebtSale, input)
    },
    getDebtSaleLines: (
      customerId: string,
      saleId: string,
    ): Promise<IpcResult<SaleLineViewDto[]>> => {
      return invoke(IpcInvokes.getDebtSaleLines, customerId, saleId)
    },
    voidCash: (saleId: string): Promise<IpcResult<{ saleId: string }>> => {
      return invoke(IpcInvokes.voidCashSale, saleId)
    },
  },
  reports: {
    getSales: (r: SalesReportInput): Promise<IpcResult<SalesReportDto>> => {
      return invoke(IpcInvokes.getSalesReport, r)
    },
  },
  settings: {
    get: (): Promise<IpcResult<AppSettingsDto>> => {
      return invoke(IpcInvokes.getAppSettings)
    },
    set: (input: UpdateAppSettingsInput): Promise<IpcResult<AppSettingsDto>> => {
      return invoke(IpcInvokes.setAppSettings, input)
    },
  },
  dashboard: {
    getSnapshot: (input?: DashboardSnapshotInput): Promise<IpcResult<DashboardSnapshotDto>> => {
      return invoke(IpcInvokes.getDashboardSnapshot, input ?? { range: 'today' })
    },
  },
  suppliers: {
    listBalances: (): Promise<IpcResult<SupplierBalanceRow[]>> => {
      return invoke(IpcInvokes.listSupplierBalances)
    },
    create: (input: CreateSupplierInput): Promise<IpcResult<SupplierDto>> => {
      return invoke(IpcInvokes.createSupplier, input)
    },
    update: (id: string, input: UpdateSupplierInput): Promise<IpcResult<SupplierDto>> => {
      return invoke(IpcInvokes.updateSupplier, id, input)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteSupplier, id)
    },
    listInvoices: (supplierId: string): Promise<IpcResult<SupplierInvoiceDto[]>> => {
      return invoke(IpcInvokes.listSupplierInvoices, supplierId)
    },
    listPayments: (supplierId: string): Promise<IpcResult<SupplierPaymentDto[]>> => {
      return invoke(IpcInvokes.listSupplierPayments, supplierId)
    },
    createInvoice: (input: CreateSupplierInvoiceInput): Promise<IpcResult<SupplierInvoiceDto>> => {
      return invoke(IpcInvokes.createSupplierInvoice, input)
    },
    createPayment: (input: CreateSupplierPaymentInput): Promise<IpcResult<SupplierPaymentDto>> => {
      return invoke(IpcInvokes.createSupplierPayment, input)
    },
  },
  expenses: {
    listCategories: (): Promise<IpcResult<ExpenseCategoryDto[]>> => {
      return invoke(IpcInvokes.listExpenseCategories)
    },
    createCategory: (input: CreateExpenseCategoryInput): Promise<IpcResult<ExpenseCategoryDto>> => {
      return invoke(IpcInvokes.createExpenseCategory, input)
    },
    updateCategory: (
      id: string,
      input: UpdateExpenseCategoryInput,
    ): Promise<IpcResult<ExpenseCategoryDto>> => {
      return invoke(IpcInvokes.updateExpenseCategory, id, input)
    },
    deleteCategory: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteExpenseCategory, id)
    },
    listInRange: (input: ListExpensesInRangeInput): Promise<IpcResult<ExpenseDto[]>> => {
      return invoke(IpcInvokes.listExpensesInRange, input)
    },
    totalInRange: (input: ListExpensesInRangeInput): Promise<IpcResult<ExpenseTotalInRangeDto>> => {
      return invoke(IpcInvokes.getExpenseTotalInRange, input)
    },
    create: (input: CreateExpenseInput): Promise<IpcResult<ExpenseDto>> => {
      return invoke(IpcInvokes.createExpense, input)
    },
    update: (id: string, input: UpdateExpenseInput): Promise<IpcResult<ExpenseDto>> => {
      return invoke(IpcInvokes.updateExpense, id, input)
    },
    delete: (id: string): Promise<IpcResult<null>> => {
      return invoke(IpcInvokes.deleteExpense, id)
    },
  },
  cashflow: {
    listRecent: (input: ListRecentCashflowInput): Promise<IpcResult<CashflowLineDto[]>> => {
      return invoke(IpcInvokes.listRecentCashflow, input)
    },
  },
})
